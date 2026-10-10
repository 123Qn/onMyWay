import { isNetworkError } from '@/lib/auth-errors';
import { dismissToast, showToast } from '@/lib/toast';

/**
 * Lightweight connectivity hint without NetInfo. The Supabase client's fetch is wrapped
 * (see `trackedFetch`): a network-level failure shows a non-blocking toast, throttled so a burst
 * of failing requests shows it once; the next response of any kind clears the offline state
 * (and dismisses the toast if it is still visible) so a later outage is announced again.
 * Only requests made through the Supabase client are observed (not image loads or Nominatim).
 */
export const OFFLINE_MESSAGE = "You're offline. Some things may not load.";

const REMIND_MS = 30_000;

let offline = false;

export function reportNetworkFailure(): void {
  offline = true;
  showToast(OFFLINE_MESSAGE, REMIND_MS);
}

export function reportNetworkSuccess(): void {
  if (!offline) return;
  offline = false;
  dismissToast(OFFLINE_MESSAGE);
}

/** Drop-in `fetch` for supabase-js that feeds the offline hint. Errors are rethrown unchanged. */
export const trackedFetch: typeof fetch = async (input, init) => {
  try {
    const response = await fetch(input, init);
    reportNetworkSuccess();
    return response;
  } catch (error) {
    // Aborts are deliberate, not connectivity problems.
    if ((error as { name?: unknown } | null)?.name !== 'AbortError' && isNetworkError(error)) {
      reportNetworkFailure();
    }
    throw error;
  }
};
