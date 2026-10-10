/** Stable error contract of the social RPCs (docs/SOCIAL-DB.md section 7). */
export type SocialErrorKind =
  | 'rate_limited'
  | 'trip_unavailable'
  | 'comment_not_found'
  | 'own_trip'
  | 'invalid_parent'
  | 'network'
  | 'other';

type ErrorLike = { code?: string; message?: string } | null | undefined;

/** `RL429` first, then the message codes; anything else is a generic failure. */
export function classifySocialError(error: ErrorLike): SocialErrorKind {
  if (!error) return 'other';
  if (error.code === 'RL429') return 'rate_limited';
  const message = error.message ?? '';
  if (message.includes('RATE_LIMITED')) return 'rate_limited';
  if (message.includes('TRIP_UNAVAILABLE')) return 'trip_unavailable';
  if (message.includes('COMMENT_NOT_FOUND')) return 'comment_not_found';
  if (message.includes('OWN_TRIP')) return 'own_trip';
  if (message.includes('INVALID_PARENT')) return 'invalid_parent';
  if (/network|fetch|timeout|offline/i.test(message)) return 'network';
  return 'other';
}

export class SocialError extends Error {
  readonly kind: SocialErrorKind;

  constructor(kind: SocialErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

export const TOAST_RATE_LIMITED = "You're doing that too fast. Try again in a moment.";
export const TOAST_UPDATE_FAILED = "Couldn't update. Check your connection and try again.";
export const TOAST_TRIP_PRIVATE = 'This trip is private now.';

/** Toast copy for a failed like/save/repost toggle. */
export function toggleErrorMessage(kind: SocialErrorKind): string {
  if (kind === 'rate_limited') return TOAST_RATE_LIMITED;
  if (kind === 'trip_unavailable') return TOAST_TRIP_PRIVATE;
  return TOAST_UPDATE_FAILED;
}
