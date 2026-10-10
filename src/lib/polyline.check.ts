import { decodePolyline } from './polyline';

/**
 * Dev-only test vectors for polyline.ts (the project has no test runner). Not imported by the app.
 * Returns a list of failures; an empty list means all vectors pass.
 */
export function polylineSelfCheck(): string[] {
  const failures: string[] = [];
  const expect = (name: string, ok: boolean) => {
    if (!ok) failures.push(name);
  };

  // Reference example from Google's polyline algorithm documentation.
  const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  expect('three points', pts.length === 3);
  expect('p0 = 38.5,-120.2', pts[0]?.latitude === 38.5 && pts[0]?.longitude === -120.2);
  expect('p1 = 40.7,-120.95', pts[1]?.latitude === 40.7 && pts[1]?.longitude === -120.95);
  expect('p2 = 43.252,-126.453', pts[2]?.latitude === 43.252 && pts[2]?.longitude === -126.453);

  expect('empty string = no points', decodePolyline('').length === 0);
  expect('truncated input = no points', decodePolyline('_p~iF~ps|U_ulL').length === 0);
  expect('invalid chars = no points', decodePolyline('  ').length === 0);
  return failures;
}
