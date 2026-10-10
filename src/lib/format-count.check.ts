import { formatCount } from './format-count';

/**
 * Dev-only test vectors for format-count.ts (the project has no test runner). Not imported by the app.
 * Returns a list of failures; an empty list means all vectors pass.
 */
export function formatCountSelfCheck(): string[] {
  const failures: string[] = [];
  const cases: [number, string][] = [
    [0, ''],
    [-3, ''],
    [1, '1'],
    [999, '999'],
    [1000, '1K'],
    [1234, '1.2K'],
    [9999, '9.9K'],
    [10_000, '10K'],
    [12_345, '12K'],
    [999_999, '999K'],
    [1_000_000, '1M'],
    [1_250_000, '1.2M'],
  ];
  for (const [input, expected] of cases) {
    const actual = formatCount(input);
    if (actual !== expected) failures.push(`${input} -> "${actual}", expected "${expected}"`);
  }
  return failures;
}
