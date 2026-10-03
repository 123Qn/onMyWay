import { isNetworkError } from '@/lib/auth-errors';

export type ErrorKind = 'network' | 'limit' | 'not_owner' | 'invalid' | 'photo_missing' | 'unknown';

/** Classifies by `error.code` (PostgREST / Postgres), never by message text. */
export function classifyTripError(error: unknown): ErrorKind {
  if (!error || typeof error !== 'object') return 'unknown';
  if (isNetworkError(error)) return 'network';
  switch ((error as { code?: unknown }).code) {
    case 'P0001':
      return 'limit';
    case '42501':
      return 'not_owner';
    case '23502':
    case '23514':
      return 'invalid';
    default:
      return 'unknown';
  }
}

export const TRIP_ERROR_COPY = {
  network: 'No connection. Check your internet and try again.',
  limit: 'A trip can have up to 20 stops and 5 photos per stop. Remove some and try again.',
  not_owner: "You can't change this trip.",
  invalid: 'Some details are not valid. Check the title and stop names, then try again.',
  photo_missing: 'A photo is no longer available. Remove it and try again.',
  unknown: 'Something went wrong. Please try again.',
  upload: 'Could not upload your photos. Please try again.',
  discard: 'Could not discard this trip. Please try again.',
} as const;

export function tripErrorMessage(kind: ErrorKind, duringUpload = false): string {
  if (kind === 'unknown' && duringUpload) return TRIP_ERROR_COPY.upload;
  return TRIP_ERROR_COPY[kind];
}

/** Retrying cannot help for these. */
export function isRetryable(kind: ErrorKind): boolean {
  return kind === 'network' || kind === 'unknown';
}
