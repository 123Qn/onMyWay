export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening';

/**
 * Time-of-day greeting from the DEVICE LOCAL hour.
 * 05:00-11:59 morning, 12:00-17:59 afternoon, otherwise (18:00-04:59) evening.
 *
 * Boundary vectors (local time): 04:59 -> evening, 05:00 -> morning, 11:59 -> morning,
 * 12:00 -> afternoon, 17:59 -> afternoon, 18:00 -> evening.
 */
export function getGreeting(date: Date): Greeting {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

const MAX_NAME = 20;

/** First whitespace-separated word of the display name (fallback: username), cut at 20 chars. */
export function getFirstName(displayName: string | null | undefined, username?: string): string {
  const word = (displayName ?? '').trim().split(/\s+/)[0] || username || '';
  return word.length > MAX_NAME ? `${word.slice(0, MAX_NAME)}…` : word;
}
