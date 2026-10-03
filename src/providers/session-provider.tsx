import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase';
import { isGeneratedUsername } from '@/lib/username';
import type { Tables } from '@/types/database';

export type Profile = Pick<
  Tables<'profiles'>,
  'id' | 'username' | 'display_name' | 'avatar_path' | 'bio'
>;

type SessionContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** True until the session AND (when signed in) the first profile fetch have settled. */
  isLoading: boolean;
  /** True when the profile could not be loaded for the signed-in user. */
  profileError: boolean;
  /** Refetches the profile. Resolves true on success. */
  refreshProfile: () => Promise<boolean>;
};

type ProfileResult = { userId: string; profile: Profile | null; error: boolean };

const SessionContext = createContext<SessionContextValue | null>(null);

/** True while the user still has the DB-generated placeholder username. */
export function needsUsername(profile: Profile): boolean {
  return isGeneratedUsername(profile.username);
}

async function loadProfile(userId: string): Promise<ProfileResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_path, bio')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return { userId, profile: null, error: true };
    return { userId, profile: data, error: false };
  } catch {
    return { userId, profile: null, error: true };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [result, setResult] = useState<ProfileResult | null>(null);

  const userId = session?.user.id ?? null;
  const userIdRef = useRef<string | null>(userId);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    // Only update state here; calling other Supabase functions inside this callback can deadlock.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Profile fetch is keyed on the user id; stale responses are ignored on user change.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadProfile(userId).then((next) => {
      if (active) setResult(next);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return false;
    const next = await loadProfile(uid);
    if (userIdRef.current !== uid) return false;
    setResult(next);
    return !next.error;
  }, []);

  // Results of a previous user are ignored, which also clears the profile on sign-out.
  const current = result && result.userId === userId ? result : null;
  const profile = current?.profile ?? null;
  const profileError = !!userId && !!current?.error;
  const isLoading = sessionLoading || (!!userId && current === null);

  const value = useMemo(
    () => ({ session, profile, isLoading, profileError, refreshProfile }),
    [session, profile, isLoading, profileError, refreshProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
