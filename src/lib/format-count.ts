/** Compact count for action buttons: 0 -> "", 1-999 as is, "1.2K", "12K", "1.2M". */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  const whole = Math.floor(n);
  if (whole < 1000) return String(whole);
  if (whole < 10_000) return `${trimZero(Math.floor(whole / 100) / 10)}K`;
  if (whole < 1_000_000) return `${Math.floor(whole / 1000)}K`;
  return `${trimZero(Math.floor(whole / 100_000) / 10)}M`;
}

function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

/** "1 like", "5 likes". */
export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
