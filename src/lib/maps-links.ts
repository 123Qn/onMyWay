/** Pure helpers that build "directions" URLs for Google Maps and Apple Maps. */

import type { TravelMode } from '@/lib/trip-form';

export type MapPoint = { lat: number; lng: number };

/** Google Maps `travelmode` values (checked against the Maps URLs docs). */
const GOOGLE_MODE: Record<TravelMode, string> = {
  driving: 'driving',
  walking: 'walking',
  cycling: 'bicycling',
};

/** Apple Maps `dirflg` flag; cycling has none, so Apple picks its default. */
function appleModeParam(mode: TravelMode): string {
  return mode === 'driving' ? '&dirflg=d' : mode === 'walking' ? '&dirflg=w' : '';
}

/**
 * Google Maps URLs accept an origin, a destination and at most 9 waypoints
 * (11 points in total) per link.
 */
export const GOOGLE_MAX_POINTS = 11;

const coord = (p: MapPoint) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Drops consecutive points that share the same coordinates (6 decimals). */
export function dedupeConsecutive<T extends MapPoint>(points: T[]): T[] {
  const result: T[] = [];
  for (const p of points) {
    const last = result[result.length - 1];
    if (!last || coord(last) !== coord(p)) result.push(p);
  }
  return result;
}

/**
 * Splits a route into legs of at most `maxPoints` points. Consecutive legs share their
 * boundary point so the route has no gap: 11 points per leg -> stops 1-11, 11-20, ...
 * Zero or one point gives a single (possibly empty) leg list.
 */
export function splitIntoLegs<T>(points: T[], maxPoints: number = GOOGLE_MAX_POINTS): T[][] {
  if (points.length === 0) return [];
  if (points.length <= maxPoints) return [points];
  const step = Math.max(1, maxPoints - 1);
  const legs: T[][] = [];
  for (let start = 0; start < points.length - 1; start += step) {
    legs.push(points.slice(start, Math.min(start + maxPoints, points.length)));
  }
  return legs;
}

/**
 * One point: directions from the viewer's location to it. Two or more: first point is the
 * origin, last the destination, the points between are waypoints. Callers split first
 * (see splitIntoLegs) so a leg never exceeds GOOGLE_MAX_POINTS.
 */
export function googleDirectionsUrl(points: MapPoint[], mode: TravelMode = 'driving'): string {
  if (points.length === 0) throw new Error('At least one point is required');
  const base = 'https://www.google.com/maps/dir/?api=1';
  const last = points[points.length - 1];
  if (points.length === 1) {
    return `${base}&destination=${encodeURIComponent(coord(last))}&travelmode=${GOOGLE_MODE[mode]}`;
  }
  const parts = [
    `origin=${encodeURIComponent(coord(points[0]))}`,
    `destination=${encodeURIComponent(coord(last))}`,
  ];
  const waypoints = points.slice(1, -1).map(coord);
  if (waypoints.length > 0) parts.push(`waypoints=${encodeURIComponent(waypoints.join('|'))}`);
  parts.push(`travelmode=${GOOGLE_MODE[mode]}`);
  return `${base}&${parts.join('&')}`;
}

/** Apple Maps cannot take waypoints reliably: one route from the first to the last point. */
export function appleDirectionsUrl(points: MapPoint[], mode: TravelMode = 'driving'): string {
  if (points.length === 0) throw new Error('At least one point is required');
  const last = points[points.length - 1];
  if (points.length === 1) {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(coord(last))}${appleModeParam(mode)}`;
  }
  return (
    `https://maps.apple.com/?saddr=${encodeURIComponent(coord(points[0]))}` +
    `&daddr=${encodeURIComponent(coord(last))}${appleModeParam(mode)}`
  );
}
