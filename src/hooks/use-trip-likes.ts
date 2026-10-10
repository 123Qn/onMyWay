import { useCallback, useEffect, useRef, useState } from 'react';

import { getAvatarUrl } from '@/lib/avatar-url';
import { fetchLikers, type LikerRow } from '@/lib/social-api';

const PAGE_SIZE = 30;

export type Liker = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  likedAt: string;
};

export type TripLikes = {
  items: Liker[];
  status: 'loading' | 'ready' | 'error';
  loadingMore: boolean;
  loadMoreError: boolean;
  hasMore: boolean;
  refreshing: boolean;
  loadMore: () => void;
  retryLoadMore: () => void;
  retry: () => void;
  refresh: () => void;
};

function toLiker(r: LikerRow): Liker {
  return {
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: getAvatarUrl(r.avatar_path),
    likedAt: r.created_at,
  };
}

/** Likers of a trip, newest like first, keyset on (created_at, user_id). */
export function useTripLikes(tripId: string): TripLikes {
  const [items, setItems] = useState<Liker[]>([]);
  const [status, setStatus] = useState<TripLikes['status']>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef(0);
  const itemsRef = useRef<Liker[]>([]);
  const loadingMoreRef = useRef(false);

  const loadFirst = useCallback(
    (mode: 'initial' | 'refresh') => {
      const request = ++requestRef.current;
      loadingMoreRef.current = false;
      fetchLikers(tripId, null, PAGE_SIZE)
        .then((rows) => {
          if (request !== requestRef.current) return;
          const next = rows.map(toLiker);
          itemsRef.current = next;
          setItems(next);
          setHasMore(rows.length === PAGE_SIZE);
          setLoadingMore(false);
          setLoadMoreError(false);
          setStatus('ready');
        })
        .catch(() => {
          if (request !== requestRef.current) return;
          if (mode === 'initial' || itemsRef.current.length === 0) setStatus('error');
        })
        .finally(() => {
          if (request === requestRef.current) setRefreshing(false);
        });
    },
    [tripId],
  );

  useEffect(() => {
    // Initial state is already 'loading'.
    loadFirst('initial');
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
      const last = itemsRef.current[itemsRef.current.length - 1];
      if (!last) return;
      const request = requestRef.current;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      fetchLikers(tripId, { createdAt: last.likedAt, id: last.userId }, PAGE_SIZE)
        .then((rows) => {
          if (request !== requestRef.current) return;
          const seen = new Set(itemsRef.current.map((i) => i.userId));
          const fresh = rows.filter((r) => !seen.has(r.user_id)).map(toLiker);
          itemsRef.current = [...itemsRef.current, ...fresh];
          setItems(itemsRef.current);
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
    [tripId, hasMore, loadMoreError, status],
  );

  const loadMore = useCallback(() => runLoadMore(false), [runLoadMore]);
  const retryLoadMore = useCallback(() => {
    setLoadMoreError(false);
    runLoadMore(true);
  }, [runLoadMore]);
  const retry = useCallback(() => {
    setStatus('loading');
    loadFirst('initial');
  }, [loadFirst]);
  const refresh = useCallback(() => {
    setRefreshing(true);
    loadFirst('refresh');
  }, [loadFirst]);

  return {
    items,
    status,
    loadingMore,
    loadMoreError,
    hasMore,
    refreshing,
    loadMore,
    retryLoadMore,
    retry,
    refresh,
  };
}
