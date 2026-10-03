import { isNetworkError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

/**
 * Signs out. Returns 'ok' when the session is gone (including the local-only fallback
 * after a network failure) and 'failed' when the caller should show a retry banner.
 */
export async function signOutUser(): Promise<'ok' | 'failed'> {
  let failure: unknown = null;
  try {
    const { error } = await supabase.auth.signOut();
    failure = error;
  } catch (e) {
    failure = e;
  }
  if (!failure) return 'ok';
  if (isNetworkError(failure)) {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      return error ? 'failed' : 'ok';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
