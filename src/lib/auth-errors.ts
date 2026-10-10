/**
 * Pure helpers that classify errors from Supabase auth / PostgREST and map them to UI copy.
 * Matching is done on `error.code` / `status` / `name`, never on message text,
 * except for the network heuristic on thrown fetch failures.
 */

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limit'
  | 'network'
  | 'user_exists'
  | 'weak_password'
  | 'unknown';

type ErrorLike = {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
};

export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as ErrorLike;
  if (e.name === 'AuthRetryableFetchError') return true;
  if (e.status === 0) return true;
  // Thrown fetch failures (React Native: "Network request failed", web: "Failed to fetch").
  return /network request failed|failed to fetch|network error/i.test(String(e.message ?? ''));
}

export function classifyAuthError(error: unknown): AuthErrorKind {
  if (!error || typeof error !== 'object') return 'unknown';
  if (isNetworkError(error)) return 'network';
  const e = error as ErrorLike;
  switch (e.code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate_limit';
    case 'user_already_exists':
    case 'email_exists':
      return 'user_exists';
    case 'weak_password':
      return 'weak_password';
  }
  if (e.status === 429) return 'rate_limit';
  return 'unknown';
}

export const AUTH_COPY = {
  generic: 'Something went wrong. Please try again.',
  network: 'No connection. Check your internet and try again.',
  rateLimit: 'Too many attempts. Please wait a minute and try again.',
  invalidCredentials: 'Incorrect email or password.',
  emailNotConfirmed: 'Please confirm your email before signing in.',
  userExists: 'An account with this email already exists.',
  weakPassword: 'That password is too easy to guess. Try a longer or more unusual one.',
} as const;

export type AuthFormError =
  | { target: 'banner'; message: string; retryable: boolean }
  | { target: 'email'; message: string }
  | { target: 'password'; message: string };

export function mapSignInError(error: unknown): AuthFormError {
  switch (classifyAuthError(error)) {
    case 'invalid_credentials':
      return { target: 'banner', message: AUTH_COPY.invalidCredentials, retryable: false };
    case 'email_not_confirmed':
      return { target: 'banner', message: AUTH_COPY.emailNotConfirmed, retryable: false };
    case 'rate_limit':
      return { target: 'banner', message: AUTH_COPY.rateLimit, retryable: false };
    case 'network':
      return { target: 'banner', message: AUTH_COPY.network, retryable: true };
    default:
      return { target: 'banner', message: AUTH_COPY.generic, retryable: false };
  }
}

export const PASSWORD_COPY = {
  wrongCurrent: 'Current password is incorrect.',
  samePassword: "Choose a password you're not using now.",
  weakPassword: 'Choose a stronger password.',
  emailRateLimit: 'Too many attempts. Wait a minute and try again.',
  requestRateLimit: 'Too many attempts. Wait a few minutes and try again.',
  sessionExpired: 'Your session expired. Sign in again.',
  network: 'Check your connection and try again.',
  generic: 'Something went wrong. Please try again.',
} as const;

export type PasswordFormError =
  | { target: 'banner'; message: string; retryable: boolean }
  | { target: 'current'; message: string }
  | { target: 'new'; message: string }
  /** The server wants a fresh proof of identity (nonce flow). */
  | { target: 'reauth' }
  /** The session is gone: show the message, then sign out. */
  | { target: 'session'; message: string };

/** Maps errors from signInWithPassword / updateUser (code first, status second). */
export function mapPasswordError(error: unknown): PasswordFormError {
  if (!error || typeof error !== 'object') {
    return { target: 'banner', message: PASSWORD_COPY.generic, retryable: false };
  }
  if (isNetworkError(error)) {
    return { target: 'banner', message: PASSWORD_COPY.network, retryable: true };
  }
  const e = error as ErrorLike;
  switch (e.code) {
    case 'invalid_credentials':
      return { target: 'current', message: PASSWORD_COPY.wrongCurrent };
    case 'same_password':
      return { target: 'new', message: PASSWORD_COPY.samePassword };
    case 'weak_password': {
      // The only server message shown as-is: it lists what the project's password rules require.
      const message =
        typeof e.message === 'string' && e.message.trim() ? e.message : PASSWORD_COPY.weakPassword;
      return { target: 'new', message };
    }
    case 'over_email_send_rate_limit':
      return { target: 'banner', message: PASSWORD_COPY.emailRateLimit, retryable: false };
    case 'over_request_rate_limit':
      return { target: 'banner', message: PASSWORD_COPY.requestRateLimit, retryable: false };
    case 'reauthentication_needed':
      return { target: 'reauth' };
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
      return { target: 'session', message: PASSWORD_COPY.sessionExpired };
  }
  if (e.status === 429) {
    return { target: 'banner', message: PASSWORD_COPY.requestRateLimit, retryable: false };
  }
  if (e.status === 401) return { target: 'session', message: PASSWORD_COPY.sessionExpired };
  if (typeof e.status === 'number' && e.status >= 500) {
    return { target: 'banner', message: PASSWORD_COPY.network, retryable: true };
  }
  return { target: 'banner', message: PASSWORD_COPY.generic, retryable: false };
}

export type RecoveryLinkProblem =
  | 'expired'
  | 'used'
  | 'other_device'
  | 'no_code'
  | 'network'
  | 'unknown';

export const RECOVERY_COPY: Record<RecoveryLinkProblem, string> = {
  expired: 'This link has expired. Request a new one.',
  used: "This link was already used or isn't valid. Request a new one.",
  other_device: 'Open the link on the phone where you asked for it, or request a new one.',
  no_code: "This link isn't valid. Request a new one.",
  network: "We couldn't check this link. Check your connection and request a new one.",
  unknown: "This link isn't valid. Request a new one.",
};

/** Classifies an error code from a failed exchange or an error redirect (never message text). */
export function classifyRecoveryCode(code: unknown): RecoveryLinkProblem {
  switch (code) {
    case 'otp_expired':
    case 'flow_state_expired':
      return 'expired';
    case 'flow_state_not_found':
    case 'bad_code_verifier':
    case 'validation_failed':
      return 'used';
    case 'pkce_code_verifier_not_found':
      return 'other_device';
    default:
      return 'unknown';
  }
}

export function mapRecoveryExchangeError(error: unknown): RecoveryLinkProblem {
  if (isNetworkError(error)) return 'network';
  const code = error && typeof error === 'object' ? (error as ErrorLike).code : undefined;
  return classifyRecoveryCode(code);
}

export function mapSignUpError(error: unknown): AuthFormError {
  switch (classifyAuthError(error)) {
    case 'user_exists':
      return { target: 'email', message: AUTH_COPY.userExists };
    case 'weak_password':
      return { target: 'password', message: AUTH_COPY.weakPassword };
    case 'rate_limit':
      return { target: 'banner', message: AUTH_COPY.rateLimit, retryable: false };
    case 'network':
      return { target: 'banner', message: AUTH_COPY.network, retryable: true };
    default:
      return { target: 'banner', message: AUTH_COPY.generic, retryable: false };
  }
}
