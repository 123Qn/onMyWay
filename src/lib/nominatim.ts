import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BASE_URL = 'https://nominatim.openstreetmap.org';
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8000;
const MAX_QUEUE = 2;
const CACHE_MAX = 50;
const CACHE_TTL_MS = 10 * 60 * 1000;
const QUERY_MIN = 2;
const QUERY_MAX = 200;

export type PlaceResult = {
  lat: number;
  lng: number;
  name: string;
  address: string;
  boundingBox: [south: number, north: number, west: number, east: number] | null;
};

export type NominatimErrorCode =
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'blocked'
  | 'server'
  | 'invalid_response'
  | 'aborted';

export class NominatimError extends Error {
  code: NominatimErrorCode;
  constructor(code: NominatimErrorCode) {
    super(`Nominatim error: ${code}`);
    this.name = 'NominatimError';
    this.code = code;
  }
}

export type ReverseJson = {
  name?: unknown;
  display_name?: unknown;
  address?: Record<string, unknown> | null;
};

// ---------------------------------------------------------------- config

const extra = Constants.expoConfig?.extra as { nominatimContactEmail?: unknown } | undefined;
const contactEmail =
  typeof extra?.nominatimContactEmail === 'string' ? extra.nominatimContactEmail.trim() : '';
if (!contactEmail && __DEV__) {
  console.warn('extra.nominatimContactEmail is missing in app.config.ts; User-Agent has no contact.');
}
const appVersion = Constants.expoConfig?.version ?? '0';
const userAgent = `onMyWay/${appVersion}${contactEmail ? ` (${contactEmail})` : ''}`;

function getLang(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale) return locale === 'en' ? 'en' : `${locale},en;q=0.5`;
  } catch {
    // fall through
  }
  return 'en';
}

// ---------------------------------------------------------------- cache (LRU + TTL)

const cache = new Map<string, { at: number; value: unknown }>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit); // most recently used goes last
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// ---------------------------------------------------------------- shared throttle

type Job = { kind: 'search' | 'reverse'; start: () => void; fail: (e: NominatimError) => void };

let queue: Job[] = [];
let lastStart = 0;
let pumpTimer: ReturnType<typeof setTimeout> | null = null;

function pump() {
  if (pumpTimer || queue.length === 0) return;
  const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - Date.now());
  pumpTimer = setTimeout(() => {
    pumpTimer = null;
    const job = queue.shift();
    if (job) {
      lastStart = Date.now();
      job.start();
    }
    pump();
  }, wait);
}

/** Runs `task` after the shared >= 1.1 s spacing between request starts. */
function schedule<T>(
  kind: Job['kind'],
  signal: AbortSignal | undefined,
  task: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new NominatimError('aborted'));
      return;
    }
    if (kind === 'search') {
      // A newer search replaces a still-queued older one.
      queue = queue.filter((j) => {
        if (j.kind !== 'search') return true;
        j.fail(new NominatimError('aborted'));
        return false;
      });
      if (queue.length >= MAX_QUEUE) {
        reject(new NominatimError('rate_limited'));
        return;
      }
    }
    const onAbort = () => {
      const i = queue.indexOf(job);
      if (i >= 0) {
        queue.splice(i, 1);
        reject(new NominatimError('aborted'));
      }
    };
    const job: Job = {
      kind,
      start: () => {
        signal?.removeEventListener('abort', onAbort);
        task().then(resolve, reject);
      },
      fail: (e) => {
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      },
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    queue.push(job);
    pump();
  });
}

// ---------------------------------------------------------------- HTTP

async function getJson(
  path: string,
  params: Record<string, string>,
  callerSignal: AbortSignal | undefined,
): Promise<unknown> {
  const lang = getLang();
  const query = new URLSearchParams({ ...params, 'accept-language': lang });
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': lang };
  if (Platform.OS === 'web') {
    // Browsers cannot set User-Agent; Nominatim accepts an email query parameter instead.
    if (contactEmail) query.set('email', contactEmail);
  } else {
    headers['User-Agent'] = userAgent;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}?${query.toString()}`, {
        headers,
        signal: controller.signal,
      });
    } catch {
      if (callerSignal?.aborted) throw new NominatimError('aborted');
      throw new NominatimError(timedOut ? 'timeout' : 'network');
    }
    if (res.status === 429) throw new NominatimError('rate_limited');
    if (res.status === 403) {
      if (__DEV__) console.warn('Nominatim returned 403 (blocked).');
      throw new NominatimError('blocked');
    }
    if (res.status >= 500) throw new NominatimError('server');
    if (!res.ok) throw new NominatimError('invalid_response');
    try {
      return await res.json();
    } catch {
      if (callerSignal?.aborted) throw new NominatimError('aborted');
      throw new NominatimError(timedOut ? 'timeout' : 'invalid_response');
    }
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

// ---------------------------------------------------------------- parsing

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Derives a short place name and the full address from a Nominatim item. */
export function defaultNameFromReverse(r: ReverseJson | null): {
  name: string;
  address: string | null;
} {
  if (!r) return { name: 'Dropped pin', address: null };
  const a = r.address ?? {};
  const road = clean(a.road, 80);
  const house = clean(a.house_number, 20);
  const area = ['neighbourhood', 'suburb', 'village', 'town', 'city', 'county']
    .map((k) => clean(a[k], 80))
    .find((v) => v.length > 0);
  const display = clean(r.display_name, 200);

  const name =
    clean(r.name, 80) ||
    (road ? clean(house ? `${house} ${road}` : road, 80) : '') ||
    area ||
    clean(display.split(',')[0], 80) ||
    'Dropped pin';
  return { name, address: display || null };
}

function parseBox(v: unknown): PlaceResult['boundingBox'] {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const n = v.map((x) => Number(x));
  if (!n.every(Number.isFinite)) return null;
  return [n[0], n[1], n[2], n[3]];
}

function parseSearchItem(item: unknown): PlaceResult | null {
  if (typeof item !== 'object' || item === null) return null;
  const o = item as ReverseJson & { lat?: unknown; lon?: unknown; boundingbox?: unknown };
  const lat = Number(o.lat);
  const lng = Number(o.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const derived = defaultNameFromReverse(o);
  return {
    lat,
    lng,
    name: derived.name,
    address: derived.address ?? derived.name,
    boundingBox: parseBox(o.boundingbox),
  };
}

// ---------------------------------------------------------------- public API

export async function searchPlaces(
  query: string,
  opts?: { signal?: AbortSignal },
): Promise<PlaceResult[]> {
  const q = query.replace(/\s+/g, ' ').trim().slice(0, QUERY_MAX);
  if (q.length < QUERY_MIN) return [];

  const key = `s:${q.toLowerCase()}:${getLang()}`;
  const cached = cacheGet<PlaceResult[]>(key);
  if (cached) return cached;

  const json = await schedule('search', opts?.signal, () =>
    getJson('/search', { format: 'jsonv2', q, limit: '5', addressdetails: '1' }, opts?.signal),
  );
  if (!Array.isArray(json)) throw new NominatimError('invalid_response');
  const results = json.map(parseSearchItem).filter((r): r is PlaceResult => r !== null);
  cacheSet(key, results);
  return results;
}

export async function reversePlace(
  lat: number,
  lng: number,
  opts?: { signal?: AbortSignal },
): Promise<{ name: string; address: string } | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('reversePlace: coordinates out of range');
  }
  const key = `r:${lat.toFixed(5)},${lng.toFixed(5)}:${getLang()}`;
  const cached = cacheGet<{ name: string; address: string } | null>(key);
  if (cached !== undefined) return cached;

  const json = await schedule('reverse', opts?.signal, () =>
    getJson(
      '/reverse',
      { format: 'jsonv2', lat: lat.toFixed(6), lon: lng.toFixed(6), zoom: '18', addressdetails: '1' },
      opts?.signal,
    ),
  );
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new NominatimError('invalid_response');
  }
  const o = json as ReverseJson & { error?: unknown };
  let value: { name: string; address: string } | null = null;
  if (!o.error) {
    const d = defaultNameFromReverse(o);
    value = { name: d.name, address: d.address ?? d.name };
  }
  cacheSet(key, value);
  return value;
}
