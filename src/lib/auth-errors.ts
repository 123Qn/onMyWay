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
