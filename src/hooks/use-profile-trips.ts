import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSignedUrls } from '@/hooks/use-signed-urls';
import { supabase } from '@/lib/supabase';
import { subscribeTripEvents } from '@/lib/trip-events';
import type { TripCardData } from '@/components/trip/trip-card';

const PAGE_SIZE = 20;

type TripRow = {
  id: string;
  title: string;
  cover_path: string | null;
  visibility: string;
  created_at: string;
  stops: { count: number }[];
};

export type ProfileTrips = {
  items: TripCardData[];
  /** Total trips (own: all visibilities, other: public). Null until loaded. */
  count: number | null;
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  /** A refresh failed while older items are still shown. */
  refreshError: boolean;
  loadingMore: boolean;
  loadMoreError: boolean;
  hasMore: boolean;
  /** Reloads the count and first page (pull to refresh). */
  refresh: () => Promise<void>;
  loadMore: () => void;
  /** Retries after a load-more error. */
  retryLoadMore: () => void;
  /** Re-signs one cover after an image load error. */
  retryCover: (path: string) => void;
  /** Retries after a first-load error. */
  retry: () => void;
};

type Options = {
  /** Null keeps the hook idle (e.g. while the profile is still loading). */
  ownerId: string | null;
  /** Restrict to public trips (other users' profiles). */
  publicOnly: boolean;
};

async function fetchPage(ownerId: string, publicOnly: boolean, cursor: TripRow | null) {
  let query = supabase
    .from('trips')
    .select('id, title, cover_path, visibility, created_at, stops(count)')
    .eq('owner_id', ownerId);
  if (publicOnly) query = query.eq('visibility', 'public');
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }
  return query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);
}

type FirstPage = { rows: TripRow[]; count: number };

/** Count + first page; null on any failure. */
async function fetchFirst(ownerId: string, publicOnly: boolean): Promise<FirstPage | null> {
  try {
    const [page, total] = await Promise.all([
      fetchPage(ownerId, publicOnly, null),
      fetchCount(ownerId, publicOnly),
    ]);
    if (page.error || total.error) return null;
    return { rows: page.data, count: total.count ?? page.data.length };
  } catch {
    return null;
  }
}

async function fetchCount(ownerId: string, publicOnly: boolean) {
  let query = supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);
  if (publicOnly) query = query.eq('visibility', 'public');
  return query;
}

/** Paginated (keyset) trips of one owner with a separate exact count. */
export function useProfileTrips({ ownerId, publicOnly }: Options): ProfileTrips {
  const [rows, setRows] = useState<TripRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<ProfileTrips['status']>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const requestRef = useRef(0);
  const rowsRef = useRef<TripRow[]>([]);
  const loadingMoreRef = useRef(false);

  // Applies the result of a first-page load. Only ever called from promise callbacks.
  const applyFirst = useCallback(
    (request: number, mode: 'initial' | 'refresh', result: FirstPage | null) => {
      if (request !== requestRef.current) return;
      setRefreshing(false);
      if (!result) {
        if (mode === 'refresh' && rowsRef.current.length > 0) setRefreshError(true);
        else setStatus('error');
        return;
      }
      rowsRef.current = result.rows;
      setRows(result.rows);
      setCount(result.count);
      setHasMore(result.rows.length === PAGE_SIZE);
      setRefreshError(false);
      setLoadingMore(false);
      setLoadMoreError(false);
      setStatus('ready');
    },
    [],
  );

  const start = useCallback(
    (mode: 'initial' | 'refresh') => {
      if (!ownerId) return;
      const request = ++requestRef.current;
      loadingMoreRef.current = false;
      fetchFirst(ownerId, publicOnly).then((result) => applyFirst(request, mode, result));
    },
    [ownerId, publicOnly, applyFirst],
  );

  useEffect(() => {
    // Initial state is already 'loading' with no rows.
    start('initial');
    return () => {
      // Invalidate in-flight responses when the owner changes or the screen unmounts
      // (the ref is a counter, not a DOM node, so reading the latest value is intended).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestRef.current++;
    };
  }, [start]);

  // Keep the list in step with deletes and visibility changes made on the trip screen.
  useEffect(
    () =>
      subscribeTripEvents((event) => {
        if (event.type === 'created' || event.type === 'updated') {
          // Only the owner's own list can contain a trip they just created or edited.
          if (!ownerId || publicOnly) return;
          const request = ++requestRef.current;
          loadingMoreRef.current = false;
          fetchFirst(ownerId, publicOnly).then((result) => applyFirst(request, 'refresh', result));
          return;
        }
        if (!rowsRef.current.some((r) => r.id === event.id)) return;
        if (event.type === 'visibility' && !(publicOnly && event.visibility === 'private')) {
          rowsRef.current = rowsRef.current.map((r) =>
            r.id === event.id ? { ...r, visibility: event.visibility } : r,
          );
        } else {
          rowsRef.current = rowsRef.current.filter((r) => r.id !== event.id);
          setCount((c) => (c === null ? c : Math.max(0, c - 1)));
        }
        setRows(rowsRef.current);
      }),
    [ownerId, publicOnly, applyFirst],
  );

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    setRefreshing(true);
    const request = ++requestRef.current;
    loadingMoreRef.current = false;
    applyFirst(request, 'refresh', await fetchFirst(ownerId, publicOnly));
  }, [ownerId, publicOnly, applyFirst]);
  const retry = useCallback(() => {
    setStatus('loading');
    start('initial');
  }, [start]);

  const runLoadMore = useCallback(
    (ignoreError: boolean) => {
    if (!ownerId || !hasMore || loadingMoreRef.current) return;
    if (loadMoreError && !ignoreError) return;
    const last = rowsRef.current[rowsRef.current.length - 1];
    if (!last) return;
    const request = requestRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    fetchPage(ownerId, publicOnly, last)
      .then(({ data, error }) => {
        if (request !== requestRef.current) return;
        if (error) {
          setLoadMoreError(true);
          return;
        }
        const seen = new Set(rowsRef.current.map((r) => r.id));
        const next = [...rowsRef.current, ...data.filter((r) => !seen.has(r.id))];
        rowsRef.current = next;
        setRows(next);
        setHasMore(data.length === PAGE_SIZE);
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
    [ownerId, publicOnly, hasMore, loadMoreError],
  );

  const loadMore = useCallback(() => runLoadMore(false), [runLoadMore]);
  const retryLoadMore = useCallback(() => {
    setLoadMoreError(false);
    runLoadMore(true);
  }, [runLoadMore]);

  const paths = useMemo(() => rows.map((r) => r.cover_path), [rows]);
  const { urls, retry: retryCover } = useSignedUrls(paths);

  const items = useMemo<TripCardData[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        coverPath: r.cover_path,
        coverUrl: r.cover_path ? (urls[r.cover_path] ?? null) : null,
        stopCount: r.stops[0]?.count ?? 0,
        createdAt: r.created_at,
        isPrivate: r.visibility === 'private',
      })),
    [rows, urls],
  );

  return {
    items,
    count,
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
