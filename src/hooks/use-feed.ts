import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TripCardData } from '@/components/trip/trip-card';
import { useSignedUrls } from '@/hooks/use-signed-urls';
import { getAvatarUrl } from '@/lib/avatar-url';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

const PAGE_SIZE = 20;

type FeedRow = Database['public']['Functions']['get_feed']['Returns'][number];

export type FeedItem = TripCardData & { ownerId: string };

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
    ? { p_before_created_at: cursor.created_at, p_before_id: cursor.trip_id, p_limit: PAGE_SIZE }
    : { p_limit: PAGE_SIZE };
  try {
    const { data, error } = await supabase.rpc('get_feed', args);
    return error ? null : data;
  } catch {
    return null;
  }
}

export function useFeed(): Feed {
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
      rowsRef.current = page;
      setRows(page);
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
        const seen = new Set(rowsRef.current.map((r) => r.trip_id));
        const next = [...rowsRef.current, ...page.filter((r) => !seen.has(r.trip_id))];
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
      rows.map((r) => ({
        id: r.trip_id,
        ownerId: r.owner_id,
        title: r.title,
        coverPath: r.cover_path || null,
        coverUrl: r.cover_path ? (urls[r.cover_path] ?? null) : null,
        stopCount: r.stop_count,
        createdAt: r.created_at,
        author: {
          username: r.username,
          displayName: r.display_name,
          avatarUrl: getAvatarUrl(r.avatar_path),
        },
      })),
    [rows, urls],
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
