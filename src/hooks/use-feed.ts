import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TripCardData } from '@/components/trip/trip-card';
import { useSignedUrls } from '@/hooks/use-signed-urls';
import { getAvatarUrl } from '@/lib/avatar-url';
import { seedTripSocial, subscribeSocialEvents } from '@/lib/social-store';
import { supabase } from '@/lib/supabase';
import { subscribeTripEvents } from '@/lib/trip-events';
import { useSession } from '@/providers/session-provider';
import type { Database } from '@/types/database';

const PAGE_SIZE = 20;

type FeedRow = Database['public']['Functions']['get_feed']['Returns'][number];

export type FeedTrip = TripCardData & { ownerId: string };

/** A trip posted by its author. `key` is `trip:<tripId>`. */
export type FeedTripItem = { kind: 'trip'; key: string; trip: FeedTrip };

/** A repost; `trip` is the ORIGINAL. `key` is `repost:<repostId>`. */
export type FeedRepostItem = {
  kind: 'repost';
  key: string;
  repostId: string;
  caption: string | null;
  /** When it was reposted. */
  createdAt: string;
  reposter: { id: string; username: string; displayName: string; avatarUrl: string | null };
  trip: FeedTrip;
};

export type FeedItem = FeedTripItem | FeedRepostItem;

export type Feed = {
  items: FeedItem[];
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  /** A refresh failed while older items are still shown. */
  refreshError: boolean;
  loadingMore: boolean;
  loadMoreError: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => void;
  retryLoadMore: () => void;
  /** Retries after a first-load error. */
  retry: () => void;
  /** Re-signs one cover after an image load error. */
  retryCover: (path: string) => void;
};

type FeedArgs = Database['public']['Functions']['get_feed']['Args'];

/** Both cursor params are sent together (a row comparison with only one is empty). */
async function fetchPage(cursor: FeedRow | null): Promise<FeedRow[] | null> {
  const args: FeedArgs = cursor
    ? { p_before_created_at: cursor.created_at, p_before_id: cursor.item_id, p_limit: PAGE_SIZE }
    : { p_limit: PAGE_SIZE };
  try {
    const { data, error } = await supabase.rpc('get_feed', args);
    return error ? null : data;
  } catch {
    return null;
  }
}

/** Seeds the shared social store from a page; the feed carries counts and flags already. */
function seedStore(page: FeedRow[], myId: string | null) {
  seedTripSocial(
    page.map((r) => ({
      tripId: r.trip_id,
      seed: {
        likeCount: r.like_count,
        commentCount: r.comment_count,
        repostCount: r.repost_count,
        liked: r.liked_by_me,
        saved: r.saved_by_me,
        reposted: r.reposted_by_me,
        // Only my own repost row identifies the repost id.
        ...(r.item_type === 'repost' && myId && r.reposter_id === myId
          ? { repostId: r.item_id }
          : {}),
      },
    })),
  );
}

export function useFeed(): Feed {
  const { profile } = useSession();
  const myIdRef = useRef<string | null>(null);
  useEffect(() => {
    myIdRef.current = profile?.id ?? null;
  }, [profile?.id]);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [status, setStatus] = useState<Feed['status']>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // A new first-page load bumps the counter, which invalidates in-flight page loads.
  const requestRef = useRef(0);
  const rowsRef = useRef<FeedRow[]>([]);
  const loadingMoreRef = useRef(false);

  // Only ever called from promise callbacks.
  const applyFirst = useCallback(
    (request: number, mode: 'initial' | 'refresh', page: FeedRow[] | null) => {
      if (request !== requestRef.current) return;
      setRefreshing(false);
      if (!page) {
        if (mode === 'refresh' && rowsRef.current.length > 0) setRefreshError(true);
        else setStatus('error');
        return;
      }
      // One feed item per item_id (an original and its reposts share trip_id).
      const seenItems = new Set<string>();
      const unique = page.filter((r) => !seenItems.has(r.item_id) && !!seenItems.add(r.item_id));
      seedStore(unique, myIdRef.current);
      rowsRef.current = unique;
      setRows(unique);
      setHasMore(page.length === PAGE_SIZE);
      setRefreshError(false);
      setLoadingMore(false);
      setLoadMoreError(false);
      setStatus('ready');
    },
    [],
  );

  const start = useCallback(
    (mode: 'initial' | 'refresh') => {
      const request = ++requestRef.current;
      loadingMoreRef.current = false;
      fetchPage(null).then((page) => applyFirst(request, mode, page));
    },
    [applyFirst],
  );

  useEffect(() => {
    // Initial state is already 'loading' with no rows.
    start('initial');
    return () => {
      // Counter, not a DOM node: reading the latest value on cleanup is intended.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestRef.current++;
    };
  }, [start]);

  // A deleted or newly private trip leaves the feed immediately.
  useEffect(
    () =>
      subscribeTripEvents((event) => {
        if (event.type === 'created' || event.type === 'updated') {
          // Re-read the first page so the new or edited trip shows at once.
          const request = ++requestRef.current;
          loadingMoreRef.current = false;
          fetchPage(null).then((page) => applyFirst(request, 'refresh', page));
          return;
        }
        if (event.type === 'visibility' && event.visibility === 'public') return;
        rowsRef.current = rowsRef.current.filter((r) => r.trip_id !== event.id);
        setRows(rowsRef.current);
      }),
    [applyFirst],
  );

  // Reposts: a new one shows at the top; a removed one leaves at once and returns on failure.
  useEffect(
    () =>
      subscribeSocialEvents((event) => {
        if (event.type === 'repost-created') {
          const request = ++requestRef.current;
          loadingMoreRef.current = false;
          fetchPage(null).then((page) => applyFirst(request, 'refresh', page));
        } else if (event.type === 'repost-removing') {
          setHiddenIds((prev) => new Set(prev).add(event.repostId));
        } else if (event.type === 'repost-remove-failed') {
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(event.repostId);
            return next;
          });
        } else {
          rowsRef.current = rowsRef.current.filter((r) => r.item_id !== event.repostId);
          setRows(rowsRef.current);
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(event.repostId);
            return next;
          });
        }
      }),
    [applyFirst],
  );

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setLoadingMore(false);
    const request = ++requestRef.current;
    loadingMoreRef.current = false;
    applyFirst(request, 'refresh', await fetchPage(null));
  }, [applyFirst, refreshing]);

  const retry = useCallback(() => {
    setStatus('loading');
    start('initial');
  }, [start]);

  const runLoadMore = useCallback(
    (ignoreError: boolean) => {
      if (!hasMore || loadingMoreRef.current || status !== 'ready') return;
      if (loadMoreError && !ignoreError) return;
      const last = rowsRef.current[rowsRef.current.length - 1];
      if (!last) return;
      const request = requestRef.current;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      fetchPage(last).then((page) => {
        if (request !== requestRef.current) return;
        loadingMoreRef.current = false;
        setLoadingMore(false);
        if (!page) {
          setLoadMoreError(true);
          return;
        }
        const seen = new Set(rowsRef.current.map((r) => r.item_id));
        const fresh = page.filter((r) => !seen.has(r.item_id) && !!seen.add(r.item_id));
        seedStore(fresh, myIdRef.current);
        const next = [...rowsRef.current, ...fresh];
        rowsRef.current = next;
        setRows(next);
        setHasMore(page.length === PAGE_SIZE);
      });
    },
    [hasMore, loadMoreError, status],
  );

  const loadMore = useCallback(() => runLoadMore(false), [runLoadMore]);
  const retryLoadMore = useCallback(() => {
    setLoadMoreError(false);
    runLoadMore(true);
  }, [runLoadMore]);

  const paths = useMemo(() => rows.map((r) => r.cover_path || null), [rows]);
  const { urls, retry: retryCover } = useSignedUrls(paths);

  const items = useMemo<FeedItem[]>(
    () =>
      rows
        .filter((r) => !hiddenIds.has(r.item_id))
        .map<FeedItem>((r) => {
          const trip: FeedTrip = {
            id: r.trip_id,
            ownerId: r.owner_id,
            title: r.title,
            coverPath: r.cover_path || null,
            coverUrl: r.cover_path ? (urls[r.cover_path] ?? null) : null,
            stopCount: r.stop_count,
            // Trip time, so a repost card's embedded trip shows when the trip was posted.
            createdAt: r.trip_created_at,
            author: {
              username: r.username,
              displayName: r.display_name,
              avatarUrl: getAvatarUrl(r.avatar_path),
            },
          };
          if (r.item_type === 'repost' && r.reposter_id) {
            return {
              kind: 'repost',
              key: `repost:${r.item_id}`,
              repostId: r.item_id,
              caption: r.repost_caption,
              createdAt: r.created_at,
              reposter: {
                id: r.reposter_id,
                username: r.reposter_username ?? '',
                displayName: r.reposter_display_name ?? 'Traveller',
                avatarUrl: getAvatarUrl(r.reposter_avatar_path),
              },
              trip,
            };
          }
          return { kind: 'trip', key: `trip:${r.trip_id}`, trip };
        }),
    [rows, urls, hiddenIds],
  );

  return {
    items,
    status,
    refreshing,
    refreshError,
    loadingMore,
    loadMoreError,
    hasMore,
    refresh,
    loadMore,
    retryLoadMore,
    retry,
    retryCover,
  };
}
