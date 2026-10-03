/** Pure geo helpers (no dependencies). Distances are straight-line, kilometres only. */

const EARTH_RADIUS_KM = 6371.0088;
/** Totals below this (km) are treated as "no distance" (10 m). */
const MIN_DISPLAY_KM = 0.01;

export type GeoPoint = { lat: number; lng: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sum of straight-line legs along the given (already sorted) stops. Null with fewer than 2 stops. */
export function routeDistanceKm(stops: readonly GeoPoint[]): number | null {
  if (stops.length < 2) return null;
  let total = 0;
  for (let i = 1; i < stops.length; i++) total += haversineKm(stops[i - 1], stops[i]);
  return total;
}

function withThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * "850 m", "12.4 km", "5 km", "1,138 km". Returns "-" for null or totals under 10 m.
 * The caller adds the "~" prefix.
 */
export function formatDistance(km: number | null): string {
  if (km === null || !Number.isFinite(km) || km < MIN_DISPLAY_KM) return '-';
  if (km < 1) {
    const metres = Math.round((km * 1000) / 10) * 10;
    return metres >= 1000 ? '1 km' : `${metres} m`;
  }
  if (km < 100) return `${km.toFixed(1).replace(/\.0$/, '')} km`;
  return `${withThousands(Math.round(km))} km`;
}

/** Spoken form of the distance, e.g. "About 12.4 kilometres in a straight line". */
export function distanceA11yLabel(km: number | null): string {
  const text = formatDistance(km);
  if (text === '-') return 'Distance not available';
  const spoken = text.endsWith(' km')
    ? `${text.slice(0, -3)} ${text === '1 km' ? 'kilometre' : 'kilometres'}`
    : `${text.slice(0, -2)} metres`;
  return `About ${spoken} in a straight line`;
}
