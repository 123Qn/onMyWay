/** Pure validators for the auth forms. Each returns an error message or null. */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_DISPLAY_NAME_LENGTH = 50;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Enter your email address.';
  if (!EMAIL_REGEX.test(v)) return 'Enter a valid email address.';
  return null;
}

/** Sign-in: non-empty only, no length rule. Passwords are never trimmed. */
export function validateSignInPassword(password: string): string | null {
  return password.length === 0 ? 'Enter your password.' : null;
}

export function validateNewPassword(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH ? 'Password must be at least 8 characters.' : null;
}

export function validateDisplayName(name: string): string | null {
  const v = name.trim();
  return v.length < 1 || v.length > MAX_DISPLAY_NAME_LENGTH ? 'Enter your name.' : null;
}
