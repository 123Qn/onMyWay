import { durationA11yLabel, formatDuration } from './format-duration';

/**
 * Dev-only test vectors for format-duration.ts (the project has no test runner). Not imported by the app.
 * Returns a list of failures; an empty list means all vectors pass.
 */
export function durationSelfCheck(): string[] {
  const failures: string[] = [];
  const expect = (name: string, ok: boolean) => {
    if (!ok) failures.push(name);
  };

  expect('30 s -> 1 min', formatDuration(30) === '1 min');
  expect('2700 s -> 45 min', formatDuration(2700) === '45 min');
  expect('7200 s -> 2 h', formatDuration(7200) === '2 h');
  expect('12100 s -> 3 h 20 min', formatDuration(12100) === '3 h 20 min');
  expect('100000 s -> 1 d 4 h', formatDuration(100000) === '1 d 4 h');
  expect('3599 s -> 1 h', formatDuration(3599) === '1 h');
  expect('86399 s -> 1 d', formatDuration(86399) === '1 d');
  expect('null -> -', formatDuration(null) === '-');
  expect('a11y', durationA11yLabel(12100) === 'About 3 hours 20 minutes');
  expect('a11y 1 h', durationA11yLabel(3600) === 'About 1 hour');
  return failures;
}
