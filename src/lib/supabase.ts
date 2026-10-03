import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

// TODO(step 2): pass the generated `Database` type: createClient<Database>(...)
// once `supabase gen types typescript` output exists in src/types/database.ts.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
  );
}

// SecureStore warns above ~2048 bytes per value; a Supabase session can be larger,
// so values are split into chunks. Kept well below the limit to allow multi-byte chars.
const CHUNK_SIZE = 1000;

// SecureStore keys may only contain alphanumerics, '.', '-' and '_'.
// Injective escape: every other char (including '_' and '.') becomes '_' + 4 hex digits of
// its UTF-16 code unit. '.' is escaped too so the '.<n>' / '.count' suffixes cannot collide.
const sanitizeKey = (key: string) =>
  key.replace(/[^A-Za-z0-9-]/g, (c) => `_${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

// iOS keychain: same options object for every call so lookups match.
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const countKey = (base: string) => `${base}.count`;
const chunkKey = (base: string, index: number) => `${base}.${index}`;

async function readCount(base: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(base), STORE_OPTIONS);
  const count = raw === null ? 0 : parseInt(raw, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const base = sanitizeKey(key);
    const count = await readCount(base);
    if (count === 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(base, i), STORE_OPTIONS);
      if (part === null) return null; // incomplete data: treat as no session
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const base = sanitizeKey(key);
    const oldCount = await readCount(base);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(chunkKey(base, i), chunks[i], STORE_OPTIONS);
    }
    // Count is written last so readers never see a count without its chunks.
    await SecureStore.setItemAsync(countKey(base), String(chunks.length), STORE_OPTIONS);
    // Remove stale chunks left over from a longer previous value.
    for (let i = chunks.length; i < oldCount; i++) {
      await SecureStore.deleteItemAsync(chunkKey(base, i), STORE_OPTIONS);
    }
  },

  async removeItem(key: string): Promise<void> {
    const base = sanitizeKey(key);
    const count = await readCount(base);
    await SecureStore.deleteItemAsync(countKey(base), STORE_OPTIONS);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(chunkKey(base, i), STORE_OPTIONS);
    }
  },
};

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On web, fall back to supabase's default (localStorage).
    ...(isWeb ? {} : { storage: secureStoreAdapter }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Documented RN pattern: refresh tokens only while the app is in the foreground.
// The subscription is kept on globalThis so Fast Refresh does not register duplicates.
type GlobalWithSub = typeof globalThis & {
  __onMyWaySupabaseAppState?: { remove: () => void };
};

if (!isWeb) {
  const g = globalThis as GlobalWithSub;
  g.__onMyWaySupabaseAppState?.remove();
  g.__onMyWaySupabaseAppState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
