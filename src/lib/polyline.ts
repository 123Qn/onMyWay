export type DecodedPoint = { latitude: number; longitude: number };

/**
 * Decodes a Google encoded polyline (precision 5, lat/lng order).
 * Returns an empty list for malformed input (truncated data or out-of-range values) so the
 * caller can fall back to straight lines instead of drawing garbage.
 */
export function decodePolyline(encoded: string): DecodedPoint[] {
  const points: DecodedPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  // Reads one zig-zag varint; null when the string ends in the middle of a value.
  const readValue = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) return null;
      result += (byte & 0x1f) * 2 ** shift;
      shift += 5;
    } while (byte >= 0x20);
    // Zig-zag: the lowest bit is the sign.
    return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
  };

  while (index < encoded.length) {
    const dLat = readValue();
    const dLng = readValue();
    if (dLat === null || dLng === null) return [];
    lat += dLat;
    lng += dLng;
    const latitude = lat / 1e5;
    const longitude = lng / 1e5;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    points.push({ latitude, longitude });
  }
  return points;
}
