import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import { subscribeTripEvents } from "@/lib/trip-events";

export type ProfileStats = { trips: number; stops: number; photos: number };

export type UseProfileStats = {
  /** Null while loading, and after a failed first load (see `error`). */
  stats: ProfileStats | null;
  isLoading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
};

const ZERO: ProfileStats = { trips: 0, stops: 0, photos: 0 };

async function fetchStats(profileId: string): Promise<ProfileStats | null> {
  try {
    const { data, error } = await supabase.rpc("get_profile_stats", {
      p_user_id: profileId,
    });
    if (error) return null;
    const row = data?.[0];
    if (!row) return ZERO;
    return {
      trips: row.trip_count,
      stops: row.stop_count,
      photos: row.photo_count,
    };
  } catch {
    return null;
  }
}

/**
 * Profile counters from the `get_profile_stats` RPC (RLS decides what the caller may count).
 * With `watchTripEvents` the counts reload after the owner creates, edits, deletes or
 * re-publishes a trip.
 */
export function useProfileStats(
  profileId: string | null,
  { watchTripEvents = false }: { watchTripEvents?: boolean } = {},
): UseProfileStats {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState(!!profileId);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!profileId) return;
    const request = ++requestRef.current;
    const result = await fetchStats(profileId);
    if (request !== requestRef.current) return;
    // Keep the previous numbers when a refresh fails.
    if (result) setStats(result);
    setError(!result);
    setIsLoading(false);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    const request = ++requestRef.current;
    fetchStats(profileId).then((result) => {
      if (request !== requestRef.current) return;
      if (result) setStats(result);
      setError(!result);
      setIsLoading(false);
    });
    return () => {
      // Invalidate in-flight responses (counter, not a DOM node).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestRef.current++;
    };
  }, [profileId]);

  useEffect(() => {
    if (!watchTripEvents || !profileId) return;
    return subscribeTripEvents(() => {
      refetch();
    });
  }, [watchTripEvents, profileId, refetch]);

  return { stats, isLoading, error, refetch };
}
