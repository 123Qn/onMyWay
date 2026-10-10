import { supabase } from '@/lib/supabase';
import type { TravelMode } from '@/lib/trip-form';

export type RouteStatus = 'ok' | 'none' | 'error';
export type RouteReason = 'no_route' | 'too_far' | 'unavailable';

/** Client-side limit for the whole routing call (Edge Function plus ORS). */
export const ROUTE_TIMEOUT_MS = 20_000;

export type LatLng = { latitude: number; longitude: number };

/** Result of one recompute attempt; the geometry is read later with `fetchTripRoute`. */
export type RouteOutcome = { status: RouteStatus; reason: RouteReason | null };

/** What the trip detail needs from `get_trip_route`. `status` is null when never computed or stale. */
export type TripRoute = {
  status: RouteStatus | null;
  reason: RouteReason | null;
  /** Encoded polyline (precision 5); only present for status 'ok'. */
  polyline: string | null;
  distanceM: number | null;
  durationS: number | null;
};

const FALLBACK: RouteOutcome = { status: 'error', reason: 'unavailable' };

function asStatus(v: unknown): RouteStatus | null {
  return v === 'ok' || v === 'none' || v === 'error' ? v : null;
}

function asReason(v: unknown): RouteReason | null {
  return v === 'no_route' || v === 'too_far' || v === 'unavailable' ? v : null;
}

export function asTravelMode(v: unknown): TravelMode {
  return v === 'walking' || v === 'cycling' ? v : 'driving';
}

/**
 * Asks the `compute-trip-route` Edge Function to (re)compute the route of a trip the caller owns.
 * Never throws and never takes longer than ROUTE_TIMEOUT_MS: a timeout, a network error or any
 * non-OK answer becomes `error/unavailable` so publishing and saving always continue.
 */
export async function computeTripRoute(tripId: string): Promise<RouteOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke('compute-trip-route', {
      body: { trip_id: tripId },
      timeout: ROUTE_TIMEOUT_MS,
    });
    if (error || !data || typeof data !== 'object') return FALLBACK;
    const body = data as { status?: unknown; reason?: unknown };
    const status = asStatus(body.status);
    if (!status) return FALLBACK;
    if (status === 'ok') return { status, reason: null };
    const reason = asReason(body.reason);
    if (status === 'none') return { status, reason: reason === 'too_far' ? 'too_far' : 'no_route' };
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** Reads the stored route of a trip (one RPC call). Null on any failure: straight lines are used. */
export async function fetchTripRoute(tripId: string): Promise<TripRoute | null> {
  try {
    const { data, error } = await supabase.rpc('get_trip_route', { p_trip_id: tripId });
    if (error) return null;
    const row = data?.[0];
    // No row = never computed.
    if (!row) return { status: null, reason: null, polyline: null, distanceM: null, durationS: null };
    const status = row.is_fresh ? asStatus(row.route_status) : null;
    const ok = status === 'ok' && !!row.polyline;
    return {
      status: status === 'ok' && !ok ? null : status,
      reason: status === 'none' ? asReason(row.reason) : null,
      polyline: ok ? row.polyline : null,
      distanceM: ok ? row.distance_m : null,
      durationS: ok ? row.duration_s : null,
    };
  } catch {
    return null;
  }
}
