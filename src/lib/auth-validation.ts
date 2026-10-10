/** Pure validators for the auth forms. Each returns an error message or null. */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt ignores everything past 72 bytes, so longer passwords are rejected up front. */
export const MAX_PASSWORD_LENGTH = 72;
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
  if (password.length < MIN_PASSWORD_LENGTH) return 'Password must be at least 8 characters.';
  if (password.length > MAX_PASSWORD_LENGTH) return 'Use 72 characters or fewer.';
  return null;
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
  return password === confirm ? null : "Passwords don't match.";
}

export function validateDisplayName(name: string): string | null {
  const v = name.trim();
  return v.length < 1 || v.length > MAX_DISPLAY_NAME_LENGTH ? 'Enter your name.' : null;
}
