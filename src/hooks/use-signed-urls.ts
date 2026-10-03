import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

const BUCKET = 'trip-photos';
const TTL_SECONDS = 3600;
const CACHE_MS = 50 * 60 * 1000;

type Entry = { url: string; expiresAt: number };

const cache = new Map<string, Entry>();

function fresh(path: string, now: number): string | null {
  const entry = cache.get(path);
  return entry && entry.expiresAt > now ? entry.url : null;
}

/** Empties the cache; called when the signed-in user changes so URLs never leak across accounts. */
export function clearSignedUrlCache(): void {
  cache.clear();
}

/** Drops a cached URL so the next hook run re-signs it (e.g. after an image load error). */
export function invalidateSignedUrl(path: string): void {
  cache.delete(path);
}

/**
 * Signs private 'trip-photos' paths in ONE batched request per call (only paths that are
 * missing or expired). Returns a map of path -> signed URL; pending paths are absent.
 */
export function useSignedUrls(paths: (string | null)[]): Record<string, string> {
  const key = useMemo(
    () => Array.from(new Set(paths.filter((p): p is string => !!p))).join('\n'),
    [paths],
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!key) return;
    const now = Date.now();
    const missing = key.split('\n').filter((p) => !fresh(p, now));
    if (missing.length === 0) return;
    let active = true;
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, TTL_SECONDS)
      .then(({ data, error }) => {
        if (error || !data) return;
        const at = Date.now();
        for (const item of data) {
          if (item.path && item.signedUrl && !item.error) {
            cache.set(item.path, { url: item.signedUrl, expiresAt: at + CACHE_MS });
          }
        }
        if (active) setVersion((v) => v + 1);
      })
      .catch(() => {
        // Covers stay on the placeholder when signing fails.
      });
    return () => {
      active = false;
    };
  }, [key]);

  return useMemo(() => {
    const result: Record<string, string> = {};
    if (!key) return result;
    // Expiry is enforced in the effect above (it re-signs expired paths when the list changes);
    // reading the cache here keeps render pure.
    for (const p of key.split('\n')) {
      const url = cache.get(p)?.url;
      if (url) result[p] = url;
    }
    return result;
    // `version` re-computes the map after the cache was filled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
}
