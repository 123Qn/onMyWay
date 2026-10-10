import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSignedUrls } from '@/hooks/use-signed-urls';
import type { ProfileTrips } from '@/hooks/use-profile-trips';
import type { TripCardData } from '@/components/trip/trip-card';
import { getAvatarUrl } from '@/lib/avatar-url';
import { fetchSavedTrips, type SavedTripRow } from '@/lib/social-api';
import { getSaveVersion, seedTripSocial, useSaveVersion } from '@/lib/social-store';
import { subscribeTripEvents } from '@/lib/trip-events';

const PAGE_SIZE = 20;

/** The list shape the profile grid needs (same as ProfileTrips without the total count). */
export type SavedTrips = Omit<ProfileTrips, 'count'>;

type Options = {
  /** Nothing is fetched until this turns true (the Saved tab was opened once). */
  enabled: boolean;
};

function seedStore(rows: SavedTripRow[]) {
  seedTripSocial(
    rows.map((r) => ({
      tripId: r.trip_id,
      seed: {
        likeCount: r.like_count,
        commentCount: r.comment_count,
        repostCount: r.repost_count,
        liked: r.liked_by_me,
        // Everything in this list is saved by definition.
        saved: true,
      },
    })),
  );
}

/**
 * The viewer's private saved trips, newest save first (keyset on save time + trip id). Trips
 * that turned private or were deleted are dropped by the server; no placeholder.
 */
export function useSavedTrips({ enabled }: Options): SavedTrips {
  const [rows, setRows] = useState<SavedTripRow[]>([]);
  const [status, setStatus] = useState<SavedTrips['status']>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const requestRef = useRef(0);
  const rowsRef = useRef<SavedTripRow[]>([]);
  const loadingMoreRef = useRef(false);
  // Save version of the last first-page load; null = never loaded.
  const loadedVersionRef = useRef<number | null>(null);
  const saveVersion = useSaveVersion();

  const loadFirst = useCallback((mode: 'initial' | 'refresh') => {
    const request = ++requestRef.current;
    loadingMoreRef.current = false;
    loadedVersionRef.current = getSaveVersion();
    return fetchSavedTrips(null, PAGE_SIZE)
      .then((page) => {
        if (request !== requestRef.current) return;
        seedStore(page);
        rowsRef.current = page;
        setRows(page);
        setHasMore(page.length === PAGE_SIZE);
        setRefreshError(false);
        setLoadingMore(false);
        setLoadMoreError(false);
        setStatus('ready');
      })
      .catch(() => {
        if (request !== requestRef.current) return;
        if (mode === 'refresh' && rowsRef.current.length > 0) setRefreshError(true);
        else setStatus('error');
      })
      .finally(() => {
        if (request === requestRef.current) setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void loadFirst('initial');
    return () => {
      // Counter, not a DOM node: invalidates in-flight responses on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestRef.current++;
    };
  }, [enabled, loadFirst]);

  // Coming back to the screen after a save or unsave elsewhere: refetch quietly.
  useFocusEffect(
    useCallback(() => {
      if (loadedVersionRef.current !== null && loadedVersionRef.current !== saveVersion) {
        void loadFirst('refresh');
      }
    }, [saveVersion, loadFirst]),
  );

  useEffect(
    () =>
      subscribeTripEvents((event) => {
        if (event.type === 'created' || event.type === 'updated') return;
        if (event.type === 'visibility' && event.visibility === 'public') return;
        if (!rowsRef.current.some((r) => r.trip_id === event.id)) return;
        rowsRef.current = rowsRef.current.filter((r) => r.trip_id !== event.id);
        setRows(rowsRef.current);
      }),
    [],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirst('refresh');
  }, [loadFirst]);

  const retry = useCallback(() => {
    setStatus('loading');
    void loadFirst('initial');
  }, [loadFirst]);

  const runLoadMore = useCallback(
    (ignoreError: boolean) => {
      if (!hasMore || loadingMoreRef.current || status !== 'ready') return;
      if (loadMoreError && !ignoreError) return;
      const last = rowsRef.current[rowsRef.current.length - 1];
      if (!last) return;
      const request = requestRef.current;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      fetchSavedTrips({ createdAt: last.created_at, id: last.trip_id }, PAGE_SIZE)
        .then((page) => {
          if (request !== requestRef.current) return;
          const seen = new Set(rowsRef.current.map((r) => r.trip_id));
          const fresh = page.filter((r) => !seen.has(r.trip_id));
          seedStore(fresh);
          rowsRef.current = [...rowsRef.current, ...fresh];
          setRows(rowsRef.current);
          setHasMore(page.length === PAGE_SIZE);
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
    [hasMore, loadMoreError, status],
  );

  const loadMore = useCallback(() => runLoadMore(false), [runLoadMore]);
  const retryLoadMore = useCallback(() => {
    setLoadMoreError(false);
    runLoadMore(true);
  }, [runLoadMore]);

  const paths = useMemo(() => rows.map((r) => r.cover_path || null), [rows]);
  const { urls, retry: retryCover } = useSignedUrls(paths);

  const items = useMemo<TripCardData[]>(
    () =>
      rows.map((r) => ({
        id: r.trip_id,
        title: r.title,
        coverPath: r.cover_path || null,
        coverUrl: r.cover_path ? (urls[r.cover_path] ?? null) : null,
        stopCount: r.stop_count,
        createdAt: r.trip_created_at,
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
