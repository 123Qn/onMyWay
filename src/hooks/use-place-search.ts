import { useCallback, useEffect, useRef, useState } from 'react';

import { NominatimError, searchPlaces, type PlaceResult } from '@/lib/nominatim';

export type PlaceSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'rate_limited';

export function usePlaceSearch() {
  const [status, setStatus] = useState<PlaceSearchStatus>('idle');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState<NominatimError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const counter = useRef(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    counter.current += 1;
    setStatus('idle');
    setResults([]);
    setError(null);
  }, []);

  const search = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++counter.current;
    setStatus('loading');
    setError(null);
    try {
      const found = await searchPlaces(query, { signal: controller.signal });
      if (id !== counter.current) return; // a newer search owns the state
      setResults(found);
      setStatus(found.length > 0 ? 'ready' : 'empty');
    } catch (e) {
      if (id !== counter.current) return;
      const err = e instanceof NominatimError ? e : new NominatimError('network');
      if (err.code === 'aborted') return;
      setResults([]);
      setError(err);
      setStatus(err.code === 'rate_limited' || err.code === 'blocked' ? 'rate_limited' : 'error');
    }
  }, []);

  return { status, results, error, search, clear };
}
