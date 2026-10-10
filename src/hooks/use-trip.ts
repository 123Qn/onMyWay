import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { TravelMode } from '@/lib/trip-form';
import { asTravelMode, fetchTripRoute, type TripRoute } from '@/lib/trip-route';
import { emitTripEvent, subscribeTripEvents } from '@/lib/trip-events';
import { listAll } from '@/lib/trip-storage';
import { useSession } from '@/providers/session-provider';

const BUCKET = 'trip-photos';
const LIST_PAGE = 100;

export type TripPhoto = { id: string; position: number; storagePath: string };

export type TripStop = {
  id: string;
  position: number;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  notes: string | null;
  photos: TripPhoto[];
};

export type TripDetail = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverPath: string | null;
  visibility: 'public' | 'private';
  travelMode: TravelMode;
  /** Stored road route; null when it could not be read (treated like "no route"). */
  route: TripRoute | null;
  createdAt: string;
  author: { username: string; displayName: string; avatarPath: string | null };
  stops: TripStop[];
};

export type TripState = {
  trip: TripDetail | null;
  /** 'unavailable' = not found, removed, or private and not yours (RLS hides it). */
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  isOwner: boolean;
  /** A pull-to-refresh failed while the previous data is still shown. */
  refreshError: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  retry: () => void;
  /** Re-reads only the stored route (after "Try again"). */
  refreshRoute: () => Promise<void>;
  /** Resolves true on success. */
  setVisibility: (next: 'public' | 'private') => Promise<boolean>;
  /** Removes Storage files, then the trip row. Resolves true on success. */
  remove: () => Promise<boolean>;
};

// One literal (no concatenation) so supabase-js can infer the embedded row types.
const SELECT =
  'id, owner_id, title, description, cover_path, visibility, travel_mode, created_at, profiles:owner_id(username, display_name, avatar_path), stops(id, position, name, lat, lng, address, notes, stop_photos(id, position, storage_path))' as const;

type Loaded = { kind: 'ok'; trip: TripDetail } | { kind: 'missing' } | { kind: 'error' };

async function fetchTrip(id: string): Promise<Loaded> {
  try {
    // Started together with the trip query (one RPC per load); its failure never fails the load.
    const routePromise = fetchTripRoute(id);
    const { data, error } = await supabase
      .from('trips')
      .select(SELECT)
      .eq('id', id)
      .order('position', { referencedTable: 'stops', ascending: true })
      .order('position', { referencedTable: 'stops.stop_photos', ascending: true })
      .maybeSingle();
    if (error) return { kind: 'error' };
    if (!data) return { kind: 'missing' };
    const author = data.profiles;
    const fetchedRoute = await routePromise;
    const route = data.stops.length >= 2 ? fetchedRoute : null;
    const stops = [...data.stops]
      .sort((a, b) => a.position - b.position)
      .map<TripStop>((s) => ({
        id: s.id,
        position: s.position,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        address: s.address,
        notes: s.notes,
        photos: [...s.stop_photos]
          .sort((a, b) => a.position - b.position)
          .map((p) => ({ id: p.id, position: p.position, storagePath: p.storage_path })),
      }));
    return {
      kind: 'ok',
      trip: {
        id: data.id,
        ownerId: data.owner_id,
        title: data.title,
        description: data.description,
        coverPath: data.cover_path,
        visibility: data.visibility === 'public' ? 'public' : 'private',
        travelMode: asTravelMode(data.travel_mode),
        route,
        createdAt: data.created_at,
        author: {
          username: author?.username ?? '',
          displayName: author?.display_name ?? 'Traveller',
          avatarPath: author?.avatar_path ?? null,
        },
        stops,
      },
    };
  } catch {
    return { kind: 'error' };
  }
}

export function useTrip(id: string): TripState {
  const { profile } = useSession();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [status, setStatus] = useState<TripState['status']>('loading');
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef(0);
  const tripRef = useRef<TripDetail | null>(null);

  const apply = useCallback((request: number, mode: 'initial' | 'refresh', result: Loaded) => {
    if (request !== requestRef.current) return;
    setRefreshing(false);
    if (result.kind === 'ok') {
      tripRef.current = result.trip;
      setTrip(result.trip);
      setRefreshError(false);
      setStatus('ready');
    } else if (result.kind === 'missing') {
      tripRef.current = null;
      setTrip(null);
      setStatus('unavailable');
    } else if (mode === 'refresh' && tripRef.current) {
      setRefreshError(true);
    } else {
      setStatus('error');
    }
  }, []);

  const start = useCallback(
    (mode: 'initial' | 'refresh') => {
      const request = ++requestRef.current;
      fetchTrip(id).then((result) => apply(request, mode, result));
    },
    [id, apply],
  );

  useEffect(() => {
    // Initial state is already 'loading'.
    start('initial');
    return () => {
      // Counter, not a DOM node: invalidates in-flight responses on unmount or id change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestRef.current++;
    };
  }, [start]);

  // An edit saved elsewhere (the edit screen) refreshes this trip in place.
  useEffect(
    () =>
      subscribeTripEvents((event) => {
        if (event.type === 'updated' && event.id === id) {
          const request = ++requestRef.current;
          fetchTrip(id).then((result) => apply(request, 'refresh', result));
        }
      }),
    [id, apply],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const request = ++requestRef.current;
    apply(request, 'refresh', await fetchTrip(id));
  }, [id, apply]);

  const retry = useCallback(() => {
    setStatus('loading');
    start('initial');
  }, [start]);

  const refreshRoute = useCallback(async () => {
    const current = tripRef.current;
    if (!current) return;
    const route = current.stops.length >= 2 ? await fetchTripRoute(current.id) : null;
    // Ignore the answer if the trip was reloaded meanwhile.
    if (tripRef.current !== current) return;
    tripRef.current = { ...current, route };
    setTrip(tripRef.current);
  }, []);

  const setVisibility = useCallback(
    async (next: 'public' | 'private') => {
      try {
        // select() makes RLS-hidden updates (0 rows) detectable.
        const { data, error } = await supabase
          .from('trips')
          .update({ visibility: next })
          .eq('id', id)
          .select('id')
          .maybeSingle();
        if (error || !data) return false;
        if (tripRef.current) tripRef.current = { ...tripRef.current, visibility: next };
        setTrip(tripRef.current);
        emitTripEvent({ type: 'visibility', id, visibility: next });
        return true;
      } catch {
        return false;
      }
    },
    [id],
  );

  const remove = useCallback(async () => {
    const current = tripRef.current;
    if (!current) return false;
    try {
      // Files first: if this fails the row is kept, so a retry still finds the files.
      const prefix = `${current.ownerId}/${current.id}`;
      const paths = await listAll(prefix);
      if (!paths) return false;
      for (let i = 0; i < paths.length; i += LIST_PAGE) {
        const chunk = paths.slice(i, i + LIST_PAGE);
        const { data, error } = await supabase.storage.from(BUCKET).remove(chunk);
        if (error || !data || data.length < chunk.length) return false;
      }
      const { data, error } = await supabase
        .from('trips')
        .delete()
        .eq('id', current.id)
        .select('id')
        .maybeSingle();
      if (error || !data) return false;
      emitTripEvent({ type: 'removed', id: current.id });
      return true;
    } catch {
      return false;
    }
  }, []);

  const isOwner = useMemo(
    () => !!trip && !!profile && trip.ownerId === profile.id,
    [trip, profile],
  );

  return { trip, status, isOwner, refreshError, refreshing, refresh, retry, refreshRoute, setVisibility, remove };
}
