import * as Linking from 'expo-linking';

import { classifyRecoveryCode, isNetworkError, type RecoveryLinkProblem } from '@/lib/auth-errors';
import { normalizeEmail } from '@/lib/auth-validation';
import { supabase } from '@/lib/supabase';

export const RESEND_COOLDOWN_MS = 60_000;

// Last send time per normalised email. Module level so leaving and reopening the screen keeps it.
const lastSentAt = new Map<string, number>();

/** Milliseconds until another reset email may be requested for this address (0 when free). */
export function resendRemainingMs(email: string, now = Date.now()): number {
  const sent = lastSentAt.get(normalizeEmail(email));
  if (sent === undefined) return 0;
  return Math.max(0, sent + RESEND_COOLDOWN_MS - now);
}

/** 42_000 -> "0:42". */
export function formatCooldown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Asks Supabase to email a reset link. The result is deliberately neutral: every outcome except
 * a network/5xx failure is 'sent', so the screen never reveals whether an account exists
 * (this includes rate-limit errors, which are per user).
 */
export async function sendResetEmail(email: string): Promise<'sent' | 'network'> {
  const normalized = normalizeEmail(email);
  const redirectTo = Linking.createURL('reset-password');
  if (__DEV__) {
    // The URL must be in the Supabase redirect allow-list (not secret).
    console.log('[auth] reset redirectTo:', redirectTo);
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo });
    if (error) {
      const status = (error as { status?: unknown }).status;
      if (isNetworkError(error) || (typeof status === 'number' && status >= 500)) return 'network';
    }
  } catch (e) {
    if (isNetworkError(e)) return 'network';
  }
  lastSentAt.set(normalized, Date.now());
  return 'sent';
}

export type RecoveryOutcome = { code: string } | { error: RecoveryLinkProblem };

type ParamReader = (key: string) => string | undefined;

function fromParams(get: ParamReader): RecoveryOutcome | null {
  const errorCode = get('error_code');
  const error = get('error');
  if (errorCode || error) return { error: classifyRecoveryCode(errorCode) };
  const code = get('code');
  if (code) return { code };
  return null;
}

/** Reads recovery params that expo-router already split out of the query string. */
export function parseRecoveryParams(
  params: Record<string, string | string[] | undefined>,
): RecoveryOutcome | null {
  return fromParams((key) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  });
}

/**
 * Reads a recovery link: query first, then fragment (Supabase puts error details there).
 * An error anywhere wins over a code. Returns null when the URL carries neither.
 */
export function parseRecoveryUrl(url: string): RecoveryOutcome | null {
  let query: RecoveryOutcome | null = null;
  try {
    const params = Linking.parse(url).queryParams ?? {};
    query = parseRecoveryParams(params as Record<string, string | string[] | undefined>);
  } catch {
    query = null;
  }
  const hashIndex = url.indexOf('#');
  let fragment: RecoveryOutcome | null = null;
  if (hashIndex >= 0) {
    const search = new URLSearchParams(url.slice(hashIndex + 1));
    fragment = fromParams((key) => search.get(key) ?? undefined);
  }
  if (fragment && 'error' in fragment) return fragment;
  if (query && 'error' in query) return query;
  return query ?? fragment;
}
