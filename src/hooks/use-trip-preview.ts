import { useEffect, useMemo, useState } from 'react';

import type { TripCardData } from '@/components/trip/trip-card';
import { useSignedUrls } from '@/hooks/use-signed-urls';
import { getAvatarUrl } from '@/lib/avatar-url';
import { supabase } from '@/lib/supabase';

export type TripPreview = {
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  trip: (TripCardData & { ownerId: string; isPublic: boolean }) | null;
  retryCover: (path: string) => void;
};

type Row = {
  id: string;
  owner_id: string;
  title: string;
  cover_path: string | null;
  visibility: string;
  created_at: string;
  profiles: { username: string; display_name: string; avatar_path: string | null } | null;
  stops: { count: number }[];
};

/** Light read of one trip for the repost preview (no stops, photos or route). */
export function useTripPreview(tripId: string): TripPreview {
  const [state, setState] = useState<{ status: TripPreview['status']; row: Row | null }>({
    status: 'loading',
    row: null,
  });

  useEffect(() => {
    let active = true;
    supabase
      .from('trips')
      .select(
        'id, owner_id, title, cover_path, visibility, created_at, profiles:owner_id(username, display_name, avatar_path), stops(count)',
      )
      .eq('id', tripId)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error) setState({ status: 'error', row: null });
          else if (!data) setState({ status: 'unavailable', row: null });
          else setState({ status: 'ready', row: data as Row });
        },
        () => {
          if (active) setState({ status: 'error', row: null });
        },
      );
    return () => {
      active = false;
    };
  }, [tripId]);

  const paths = useMemo(() => [state.row?.cover_path ?? null], [state.row]);
  const { urls, retry } = useSignedUrls(paths);

  const trip = useMemo(() => {
    const r = state.row;
    if (!r) return null;
    return {
      id: r.id,
      ownerId: r.owner_id,
      isPublic: r.visibility === 'public',
      title: r.title,
      coverPath: r.cover_path,
      coverUrl: r.cover_path ? (urls[r.cover_path] ?? null) : null,
      stopCount: r.stops[0]?.count ?? 0,
      createdAt: r.created_at,
      author: r.profiles
        ? {
            username: r.profiles.username,
            displayName: r.profiles.display_name,
            avatarUrl: getAvatarUrl(r.profiles.avatar_path),
          }
        : undefined,
    };
  }, [state.row, urls]);

  return { status: state.status, trip, retryCover: retry };
}
