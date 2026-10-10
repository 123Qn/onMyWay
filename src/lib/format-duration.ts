/**
 * Rough travel time for the trip detail, without the "~" prefix (the caller adds it).
 * Under 1 min -> "1 min"; under 1 h -> whole minutes ("45 min"); under 24 h -> "3 h 20 min"
 * (minutes rounded to 5 above 1 h, " 0 min" dropped); 24 h or more -> "1 d 4 h".
 * Returns "-" for null or invalid input.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '-';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  // Round to 5 minutes above one hour; just under 24 h can round up to a full day.
  const totalMin = Math.round(seconds / 300) * 5;
  if (totalMin < 1440) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
  const totalHours = Math.round(seconds / 3600);
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return h === 0 ? `${d} d` : `${d} d ${h} h`;
}

/** Spoken form, e.g. "About 3 hours 20 minutes". */
export function durationA11yLabel(seconds: number | null): string {
  const text = formatDuration(seconds);
  if (text === '-') return 'Duration not available';
  const unit = (n: string, one: string, many: string) => (n === '1' ? one : many);
  const spoken = text.replace(/(\d+) (min|h|d)/g, (_m, n: string, u: string) =>
    u === 'min'
      ? `${n} ${unit(n, 'minute', 'minutes')}`
      : u === 'h'
        ? `${n} ${unit(n, 'hour', 'hours')}`
        : `${n} ${unit(n, 'day', 'days')}`,
  );
  return `About ${spoken}`;
}
