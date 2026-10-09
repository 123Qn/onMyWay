// Google encoded polyline (precision 5) codec + point-count reduction.
// Points are [lat, lng] pairs.

export type LatLng = [number, number];

export function decodePolyline(encoded: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    for (let axis = 0; axis < 2; axis++) {
      let result = 0, shift = 0, b: number;
      do {
        if (i >= encoded.length) throw new Error("bad polyline");
        b = encoded.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

function encodeValue(v: number, parts: string[]): void {
  let n = v < 0 ? ~(v << 1) : v << 1;
  while (n >= 0x20) {
    parts.push(String.fromCharCode((0x20 | (n & 0x1f)) + 63));
    n >>= 5;
  }
  parts.push(String.fromCharCode(n + 63));
}

export function encodePolyline(points: LatLng[]): string {
  const parts: string[] = [];
  let pLat = 0, pLng = 0;
  for (const [la, ln] of points) {
    const lat = Math.round(la * 1e5), lng = Math.round(ln * 1e5);
    encodeValue(lat - pLat, parts);
    encodeValue(lng - pLng, parts);
    pLat = lat;
    pLng = lng;
  }
  return parts.join("");
}

/**
 * Keeps at most `max` points (always first and last). One Douglas-Peucker pass
 * ranks every point by the deviation at which it would be picked; the `max - 2`
 * most significant interior points are kept in original order.
 */
export function reducePoints(pts: LatLng[], max: number): LatLng[] {
  if (pts.length <= max) return pts;
  const n = pts.length;
  const midLat = (pts[0][0] + pts[n - 1][0]) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const x = (i: number) => pts[i][1] * kx;
  const y = (i: number) => pts[i][0];

  const importance = new Float64Array(n);
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = x(a), ay = y(a), dx = x(b) - ax, dy = y(b) - ay;
    const len2 = dx * dx + dy * dy;
    let best = -1, bestD = -1;
    for (let i = a + 1; i < b; i++) {
      let d: number;
      if (len2 === 0) {
        d = Math.hypot(x(i) - ax, y(i) - ay);
      } else {
        const t = Math.max(0, Math.min(1, ((x(i) - ax) * dx + (y(i) - ay) * dy) / len2));
        d = Math.hypot(x(i) - (ax + t * dx), y(i) - (ay + t * dy));
      }
      if (d > bestD) { bestD = d; best = i; }
    }
    importance[best] = bestD;
    stack.push([a, best], [best, b]);
  }

  const idx: number[] = [];
  for (let i = 1; i < n - 1; i++) idx.push(i);
  idx.sort((p, q) => importance[q] - importance[p]);
  const keep = idx.slice(0, max - 2).sort((p, q) => p - q);
  return [pts[0], ...keep.map((i) => pts[i]), pts[n - 1]];
}
