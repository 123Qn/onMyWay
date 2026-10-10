import { AccessibilityInfo } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getAvatarUrl } from '@/lib/avatar-url';
import {
  createComment,
  deleteComment,
  fetchComments,
  fetchReplies,
  setCommentLike,
  type CommentRow,
} from '@/lib/social-api';
import { SocialError, TOAST_RATE_LIMITED, TOAST_UPDATE_FAILED } from '@/lib/social-errors';
import { updateTripSocial } from '@/lib/social-store';
import { showToast } from '@/lib/toast';

const PAGE_SIZE = 20;
const FIRST_REPLIES = 5;
const MORE_REPLIES = 20;
export const MAX_COMMENT_LENGTH = 500;

const TOAST_COMMENT_RATE = "You're commenting too fast. Try again in a moment.";
const TOAST_DELETE_FAILED = "Couldn't delete the comment. Try again.";

export type CommentNode = {
  /** Stable client key: kept when the server id arrives so the row is not remounted. */
  key: string;
  id: string | null;
  /** Key of the top-level comment this reply belongs to; null for top-level comments. */
  parentKey: string | null;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  replyCount: number;
  canDelete: boolean;
  status: 'sent' | 'sending' | 'failed';
  failure: 'rate_limited' | 'other' | null;
};

export type Thread = {
  replies: CommentNode[];
  expanded: boolean;
  loading: boolean;
  error: boolean;
};

type State = {
  top: CommentNode[];
  threads: Record<string, Thread>;
};

export type ReplyTarget = { parentKey: string; username: string };

export type Author = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type Comments = {
  top: CommentNode[];
  threads: Record<string, Thread>;
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  loadingMore: boolean;
  loadMoreError: boolean;
  hasMore: boolean;
  /** The trip became private or was deleted while the screen was open. */
  unavailable: boolean;
  loadMore: () => void;
  retryLoadMore: () => void;
  retry: () => void;
  refresh: () => void;
  send: (body: string, replyTo: ReplyTarget | null) => void;
  retrySend: (key: string) => void;
  discard: (key: string) => void;
  toggleReplies: (parentKey: string) => void;
  loadMoreReplies: (parentKey: string) => void;
  retryReplies: (parentKey: string) => void;
  toggleLike: (key: string) => void;
  remove: (key: string) => void;
};

const EMPTY_THREAD: Thread = { replies: [], expanded: false, loading: false, error: false };

/** Trim both ends and collapse 3+ consecutive newlines to 2. */
export function normalizeCommentBody(text: string): string {
  return text.trim().replace(/\n{3,}/g, '\n\n');
}

function nodeFromRow(row: CommentRow, parentKey: string | null): CommentNode {
  return {
    key: `comment:${row.comment_id}`,
    id: row.comment_id,
    parentKey,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: getAvatarUrl(row.avatar_path),
    body: row.body,
    createdAt: row.created_at,
    likeCount: row.like_count,
    liked: row.liked_by_me,
    replyCount: row.reply_count,
    canDelete: row.can_delete,
    status: 'sent',
    failure: null,
  };
}

function bySentOrder(a: CommentNode, b: CommentNode): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return (a.id ?? '') < (b.id ?? '') ? -1 : 1;
}

/** Replies from the server, oldest first, followed by the viewer's unsent ones. */
function mergeReplies(existing: CommentNode[], incoming: CommentNode[]): CommentNode[] {
  const sent = new Map<string, CommentNode>();
  for (const node of existing) if (node.status === 'sent' && node.id) sent.set(node.id, node);
  for (const node of incoming) if (node.id && !sent.has(node.id)) sent.set(node.id, node);
  const pending = existing.filter((n) => n.status !== 'sent');
  return [...[...sent.values()].sort(bySentOrder), ...pending];
}

/**
 * Comments of one trip: top-level page (newest first), lazily loaded one-level replies,
 * optimistic send with retry, delete with restore, and comment likes. Keys stay stable across
 * the optimistic -> server transition.
 */
export function useComments(tripId: string, me: Author | null): Comments {
  const [state, setState] = useState<State>({ top: [], threads: {} });
  const [status, setStatus] = useState<Comments['status']>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const stateRef = useRef<State>(state);
  const requestRef = useRef(0);
  const topCursorRef = useRef<{ createdAt: string; id: string } | null>(null);
  const replyCursorsRef = useRef(new Map<string, { createdAt: string; id: string }>());
  const loadingMoreRef = useRef(false);
  const seqRef = useRef(0);
  const meRef = useRef(me);
  const likeConfirmed = useRef(new Map<string, { liked: boolean; count: number }>());
  const likeDesired = useRef(new Map<string, boolean>());
  const likeInflight = useRef(new Set<string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const apply = useCallback((fn: (prev: State) => State) => {
    stateRef.current = fn(stateRef.current);
    setState(stateRef.current);
  }, []);

  const patchNode = useCallback(
    (key: string, patch: Partial<CommentNode>) => {
      apply((prev) => {
        const topIndex = prev.top.findIndex((n) => n.key === key);
        if (topIndex >= 0) {
          const top = prev.top.slice();
          top[topIndex] = { ...top[topIndex], ...patch };
          return { ...prev, top };
        }
        const threads = { ...prev.threads };
        for (const parentKey of Object.keys(threads)) {
          const thread = threads[parentKey];
          const index = thread.replies.findIndex((n) => n.key === key);
          if (index >= 0) {
            const replies = thread.replies.slice();
            replies[index] = { ...replies[index], ...patch };
            threads[parentKey] = { ...thread, replies };
            return { ...prev, threads };
          }
        }
        return prev;
      });
    },
    [apply],
  );

  const patchThread = useCallback(
    (parentKey: string, patch: Partial<Thread>) => {
      apply((prev) => ({
        ...prev,
        threads: {
          ...prev.threads,
          [parentKey]: { ...(prev.threads[parentKey] ?? EMPTY_THREAD), ...patch },
        },
      }));
    },
    [apply],
  );

  const findNode = useCallback((key: string): CommentNode | null => {
    const { top, threads } = stateRef.current;
    const hit = top.find((n) => n.key === key);
    if (hit) return hit;
    for (const thread of Object.values(threads)) {
      const reply = thread.replies.find((n) => n.key === key);
      if (reply) return reply;
    }
    return null;
  }, []);

  const seedLikes = useCallback((nodes: CommentNode[]) => {
    for (const node of nodes) {
      if (node.id) likeConfirmed.current.set(node.id, { liked: node.liked, count: node.likeCount });
    }
  }, []);

  // ---- top-level list -------------------------------------------------------------------

  const loadFirst = useCallback(
    (mode: 'initial' | 'refresh') => {
      const request = ++requestRef.current;
      loadingMoreRef.current = false;
      return fetchComments(tripId, null, PAGE_SIZE)
        .then((rows) => {
          if (request !== requestRef.current) return;
          const nodes = rows.map((r) => nodeFromRow(r, null));
          seedLikes(nodes);
          topCursorRef.current = rows.length
            ? { createdAt: rows[rows.length - 1].created_at, id: rows[rows.length - 1].comment_id }
            : null;
          replyCursorsRef.current.clear();
          // Unsent and failed comments of the viewer stay on top until retried or discarded.
          const pending = stateRef.current.top.filter((n) => n.status !== 'sent');
          const pendingReplies: State['threads'] = {};
          for (const [parentKey, thread] of Object.entries(stateRef.current.threads)) {
            const unsent = thread.replies.filter((n) => n.status !== 'sent');
            if (unsent.length > 0 && nodes.some((n) => n.key === parentKey)) {
              pendingReplies[parentKey] = { ...EMPTY_THREAD, replies: unsent };
            }
          }
          apply(() => ({ top: [...pending, ...nodes], threads: pendingReplies }));
          setHasMore(rows.length === PAGE_SIZE);
          setLoadMoreError(false);
          setLoadingMore(false);
          setStatus('ready');
        })
        .catch((error: unknown) => {
          if (request !== requestRef.current) return;
          if (error instanceof SocialError && error.kind === 'trip_unavailable') {
            setUnavailable(true);
          }
          if (mode === 'initial' || stateRef.current.top.length === 0) setStatus('error');
        })
        .finally(() => {
          if (request === requestRef.current) setRefreshing(false);
        });
    },
    [tripId, apply, seedLikes],
  );

  useEffect(() => {
    // Initial state is already 'loading'.
    void loadFirst('initial');
    return () => {
      // Counter, not a DOM node: invalidates in-flight responses on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestRef.current++;
    };
  }, [loadFirst]);

  const runLoadMore = useCallback(
    (ignoreError: boolean) => {
      if (!hasMore || loadingMoreRef.current || status !== 'ready') return;
      if (loadMoreError && !ignoreError) return;
      const cursor = topCursorRef.current;
      if (!cursor) return;
      const request = requestRef.current;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      fetchComments(tripId, cursor, PAGE_SIZE)
        .then((rows) => {
          if (request !== requestRef.current) return;
          const known = new Set(
            stateRef.current.top.map((n) => n.id).filter((id): id is string => !!id),
          );
          const nodes = rows.filter((r) => !known.has(r.comment_id)).map((r) => nodeFromRow(r, null));
          seedLikes(nodes);
          if (rows.length > 0) {
            const last = rows[rows.length - 1];
            topCursorRef.current = { createdAt: last.created_at, id: last.comment_id };
          }
          apply((prev) => ({ ...prev, top: [...prev.top, ...nodes] }));
          setHasMore(rows.length === PAGE_SIZE);
        })
        .catch(() => {
          if (request === requestRef.current) setLoadMoreError(true);
        })
        .finally(() => {
          if (request === requestRef.current) {
            loadingMoreRef.current = false;
            setLoadingMore(false);
          }
        });
    },
    [tripId, hasMore, loadMoreError, status, apply, seedLikes],
  );

  const loadMore = useCallback(() => runLoadMore(false), [runLoadMore]);
  const retryLoadMore = useCallback(() => {
    setLoadMoreError(false);
    runLoadMore(true);
  }, [runLoadMore]);
  const retry = useCallback(() => {
    setStatus('loading');
    void loadFirst('initial');
  }, [loadFirst]);
  const refresh = useCallback(() => {
    setRefreshing(true);
    void loadFirst('refresh');
  }, [loadFirst]);

  // ---- replies --------------------------------------------------------------------------

  const loadReplies = useCallback(
    (parentKey: string, limit: number) => {
      const parent = stateRef.current.top.find((n) => n.key === parentKey);
      if (!parent?.id) return;
      patchThread(parentKey, { loading: true, error: false });
      fetchReplies(parent.id, replyCursorsRef.current.get(parentKey) ?? null, limit)
        .then((rows) => {
          if (!mountedRef.current) return;
          const nodes = rows.map((r) => nodeFromRow(r, parentKey));
          seedLikes(nodes);
          if (rows.length > 0) {
            const last = rows[rows.length - 1];
            replyCursorsRef.current.set(parentKey, { createdAt: last.created_at, id: last.comment_id });
          }
          apply((prev) => {
            const thread = prev.threads[parentKey] ?? EMPTY_THREAD;
            return {
              ...prev,
              threads: {
                ...prev.threads,
                [parentKey]: {
                  ...thread,
                  replies: mergeReplies(thread.replies, nodes),
                  loading: false,
                  error: false,
                },
              },
            };
          });
        })
        .catch(() => {
          if (mountedRef.current) patchThread(parentKey, { loading: false, error: true });
        });
    },
    [apply, patchThread, seedLikes],
  );

  const toggleReplies = useCallback(
    (parentKey: string) => {
      const thread = stateRef.current.threads[parentKey] ?? EMPTY_THREAD;
      const parent = stateRef.current.top.find((n) => n.key === parentKey);
      if (thread.expanded) {
        patchThread(parentKey, { expanded: false });
        return;
      }
      patchThread(parentKey, { expanded: true });
      const loaded = thread.replies.filter((n) => n.status === 'sent').length;
      if (parent && parent.replyCount > loaded && !thread.loading) loadReplies(parentKey, FIRST_REPLIES);
    },
    [loadReplies, patchThread],
  );

  const loadMoreReplies = useCallback(
    (parentKey: string) => {
      if (stateRef.current.threads[parentKey]?.loading) return;
      loadReplies(parentKey, MORE_REPLIES);
    },
    [loadReplies],
  );

  const retryReplies = useCallback(
    (parentKey: string) => {
      const loaded = (stateRef.current.threads[parentKey]?.replies ?? []).filter(
        (n) => n.status === 'sent',
      ).length;
      loadReplies(parentKey, loaded === 0 ? FIRST_REPLIES : MORE_REPLIES);
    },
    [loadReplies],
  );

  // ---- send -----------------------------------------------------------------------------

  const performSend = useCallback(
    (key: string) => {
      const node = findNode(key);
      if (!node) return;
      const parent = node.parentKey ? stateRef.current.top.find((n) => n.key === node.parentKey) : null;
      if (node.parentKey && !parent?.id) {
        patchNode(key, { status: 'failed', failure: 'other' });
        return;
      }
      createComment(tripId, parent?.id ?? null, node.body)
        .then((row) => {
          if (!mountedRef.current) return;
          const settled = nodeFromRow(row, node.parentKey);
          seedLikes([settled]);
          // Keep the client key so the row is not remounted.
          patchNode(key, {
            id: row.comment_id,
            createdAt: row.created_at,
            canDelete: row.can_delete,
            status: 'sent',
            failure: null,
          });
          updateTripSocial(tripId, { commentCount: row.comment_count });
          AccessibilityInfo.announceForAccessibility(node.parentKey ? 'Reply posted' : 'Comment posted');
        })
        .catch((error: unknown) => {
          if (!mountedRef.current) return;
          const kind = error instanceof SocialError ? error.kind : 'other';
          patchNode(key, { status: 'failed', failure: kind === 'rate_limited' ? 'rate_limited' : 'other' });
          if (kind === 'rate_limited') showToast(TOAST_COMMENT_RATE, 3000);
          else if (kind === 'trip_unavailable') setUnavailable(true);
          else if (kind === 'invalid_parent') refresh();
        });
    },
    [tripId, findNode, patchNode, seedLikes, refresh],
  );

  const send = useCallback(
    (rawBody: string, replyTo: ReplyTarget | null) => {
      const author = meRef.current;
      const body = normalizeCommentBody(rawBody);
      if (!author || body.length === 0 || body.length > MAX_COMMENT_LENGTH) return;
      const key = `local:${++seqRef.current}`;
      const node: CommentNode = {
        key,
        id: null,
        parentKey: replyTo?.parentKey ?? null,
        userId: author.id,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        body,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        liked: false,
        replyCount: 0,
        canDelete: true,
        status: 'sending',
        failure: null,
      };
      if (replyTo) {
        apply((prev) => {
          const thread = prev.threads[replyTo.parentKey] ?? EMPTY_THREAD;
          const top = prev.top.map((n) =>
            n.key === replyTo.parentKey ? { ...n, replyCount: n.replyCount + 1 } : n,
          );
          return {
            top,
            threads: {
              ...prev.threads,
              [replyTo.parentKey]: { ...thread, expanded: true, replies: [...thread.replies, node] },
            },
          };
        });
      } else {
        apply((prev) => ({ ...prev, top: [node, ...prev.top] }));
      }
      performSend(key);
    },
    [apply, performSend],
  );

  const retrySend = useCallback(
    (key: string) => {
      patchNode(key, { status: 'sending', failure: null });
      performSend(key);
    },
    [patchNode, performSend],
  );

  // ---- delete ---------------------------------------------------------------------------

  /** Removes a node (and its thread). Returns a function that puts everything back. */
  const detach = useCallback(
    (key: string): (() => void) | null => {
      const snapshot = stateRef.current;
      const topIndex = snapshot.top.findIndex((n) => n.key === key);
      if (topIndex >= 0) {
        const node = snapshot.top[topIndex];
        const thread = snapshot.threads[key];
        apply((prev) => {
          const threads = { ...prev.threads };
          delete threads[key];
          return { top: prev.top.filter((n) => n.key !== key), threads };
        });
        return () =>
          apply((prev) => {
            const top = prev.top.slice();
            top.splice(Math.min(topIndex, top.length), 0, node);
            return { top, threads: thread ? { ...prev.threads, [key]: thread } : prev.threads };
          });
      }
      for (const [parentKey, thread] of Object.entries(snapshot.threads)) {
        const index = thread.replies.findIndex((n) => n.key === key);
        if (index < 0) continue;
        const node = thread.replies[index];
        apply((prev) => {
          const current = prev.threads[parentKey];
          if (!current) return prev;
          return {
            top: prev.top.map((n) =>
              n.key === parentKey ? { ...n, replyCount: Math.max(0, n.replyCount - 1) } : n,
            ),
            threads: {
              ...prev.threads,
              [parentKey]: { ...current, replies: current.replies.filter((n) => n.key !== key) },
            },
          };
        });
        return () =>
          apply((prev) => {
            const current = prev.threads[parentKey] ?? EMPTY_THREAD;
            const replies = current.replies.slice();
            replies.splice(Math.min(index, replies.length), 0, node);
            return {
              top: prev.top.map((n) =>
                n.key === parentKey ? { ...n, replyCount: n.replyCount + 1 } : n,
              ),
              threads: { ...prev.threads, [parentKey]: { ...current, replies } },
            };
          });
      }
      return null;
    },
    [apply],
  );

  const discard = useCallback(
    (key: string) => {
      detach(key);
    },
    [detach],
  );

  const remove = useCallback(
    (key: string) => {
      const node = findNode(key);
      if (!node) return;
      const restore = detach(key);
      if (!node.id) return; // never reached the server
      deleteComment(node.id)
        .then((commentCount) => {
          updateTripSocial(tripId, { commentCount });
          AccessibilityInfo.announceForAccessibility('Comment deleted');
        })
        .catch((error: unknown) => {
          const kind = error instanceof SocialError ? error.kind : 'other';
          // Already gone: nothing to bring back.
          if (kind === 'comment_not_found') return;
          if (mountedRef.current) restore?.();
          showToast(kind === 'rate_limited' ? TOAST_RATE_LIMITED : TOAST_DELETE_FAILED);
        });
    },
    [tripId, findNode, detach],
  );

  // ---- comment likes --------------------------------------------------------------------

  const pumpLike = useCallback(
    async (key: string, id: string) => {
      if (likeInflight.current.has(id)) return;
      likeInflight.current.add(id);
      try {
        for (let round = 0; round < 6; round++) {
          const want = likeDesired.current.get(id);
          const confirmed = likeConfirmed.current.get(id);
          if (want === undefined || !confirmed || want === confirmed.liked) return;
          try {
            const result = await setCommentLike(id, want);
            likeConfirmed.current.set(id, { liked: result.liked, count: result.likeCount });
            if (!mountedRef.current) return;
            // Show the canonical count unless the user toggled again meanwhile.
            if (likeDesired.current.get(id) === result.liked) {
              patchNode(key, { liked: result.liked, likeCount: result.likeCount });
            }
          } catch (error) {
            const back = likeConfirmed.current.get(id);
            likeDesired.current.delete(id);
            if (back && mountedRef.current) patchNode(key, { liked: back.liked, likeCount: back.count });
            const kind = error instanceof SocialError ? error.kind : 'other';
            showToast(kind === 'rate_limited' ? TOAST_RATE_LIMITED : TOAST_UPDATE_FAILED, 5000);
            return;
          }
        }
      } finally {
        likeInflight.current.delete(id);
      }
    },
    [patchNode],
  );

  const toggleLike = useCallback(
    (key: string) => {
      const node = findNode(key);
      if (!node?.id) return;
      const confirmed = likeConfirmed.current.get(node.id) ?? { liked: node.liked, count: node.likeCount };
      likeConfirmed.current.set(node.id, confirmed);
      const want = !node.liked;
      likeDesired.current.set(node.id, want);
      // Counts derive from the confirmed one, never +1 per tap.
      const count = Math.max(0, confirmed.count + (want ? 1 : 0) - (confirmed.liked ? 1 : 0));
      patchNode(key, { liked: want, likeCount: count });
      AccessibilityInfo.announceForAccessibility(want ? 'Liked' : 'Like removed');
      void pumpLike(key, node.id);
    },
    [findNode, patchNode, pumpLike],
  );

  return {
    top: state.top,
    threads: state.threads,
    status,
    refreshing,
    loadingMore,
    loadMoreError,
    hasMore,
    unavailable,
    loadMore,
    retryLoadMore,
    retry,
    refresh,
    send,
    retrySend,
    discard,
    toggleReplies,
    loadMoreReplies,
    retryReplies,
    toggleLike,
    remove,
  };
}
