import { distanceA11yLabel, formatDistance, haversineKm, routeDistanceKm } from './geo';

/**
 * Dev-only test vectors for geo.ts (the project has no test runner). Not imported by the app.
 * Returns a list of failures; an empty list means all vectors pass.
 */
export function geoSelfCheck(): string[] {
  const failures: string[] = [];
  const expect = (name: string, ok: boolean) => {
    if (!ok) failures.push(name);
  };

  const oneDegree = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  expect('(0,0)->(0,1) = 111.2 km', Math.abs(oneDegree - 111.2) < 0.1);

  const hanoi = { lat: 21.0285, lng: 105.8542 };
  const hcmc = { lat: 10.8231, lng: 106.6297 };
  expect('Hanoi->HCMC about 1138 km', Math.abs(haversineKm(hanoi, hcmc) - 1138) <= 5);

  expect('same point twice = 0', haversineKm(hanoi, hanoi) === 0);
  expect('one stop = null', routeDistanceKm([hanoi]) === null);
  expect('same point twice shows "-"', formatDistance(routeDistanceKm([hanoi, hanoi])) === '-');
  expect('sums consecutive legs', Math.abs((routeDistanceKm([hanoi, hcmc, hanoi]) ?? 0) - 2 * haversineKm(hanoi, hcmc)) < 1e-9);

  expect('0.85 -> 850 m', formatDistance(0.85) === '850 m');
  expect('0.8549 -> 850 m', formatDistance(0.8549) === '850 m');
  expect('0.9996 -> 1 km', formatDistance(0.9996) === '1 km');
  expect('12.43 -> 12.4 km', formatDistance(12.43) === '12.4 km');
  expect('5.02 -> 5 km', formatDistance(5.02) === '5 km');
  expect('99.96 -> 100 km', formatDistance(99.96) === '100 km');
  expect('1137.6 -> 1,138 km', formatDistance(1137.6) === '1,138 km');
  expect('0.009 -> -', formatDistance(0.009) === '-');
  expect('null -> -', formatDistance(null) === '-');
  expect('a11y km', distanceA11yLabel(12.4) === 'About 12.4 kilometres in a straight line');
  expect('a11y m', distanceA11yLabel(0.85) === 'About 850 metres in a straight line');
  return failures;
}
