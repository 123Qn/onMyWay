#!/usr/bin/env node
// Official showcase trip seed tool. Usage: node scripts/seed-official/seed.mjs <verify|fetch-covers|seed> [flags]
// Node 20 built-ins + @supabase/supabase-js only. Never uses the service_role key.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const COVERS = join(HERE, 'covers');

// Limits mirrored from src/lib/trip-form.ts
const MAX_STOPS = 20;
const TITLE_MAX = 120;
const STOP_NAME_MAX = 120;
const TEXT_MAX = 5000;
const MODES = ['driving', 'walking', 'cycling'];
const VISIBILITIES = ['public', 'private'];
const BUCKET = 'trip-photos';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Region hint appended to each stop name when geocoding (trips.json has no region field).
const REGIONS = {
  'bondi-to-coogee-coastal-walk': 'Sydney, Australia',
  'sydney-harbour-icons-walk': 'Sydney, Australia',
  'blue-mountains-day-trip': 'Blue Mountains, New South Wales, Australia',
  'royal-national-park-kiama-drive': 'New South Wales, Australia',
  'great-ocean-road-highlights': 'Victoria, Australia',
  'melbourne-laneways-walk': 'Melbourne, Australia',
  'gold-coast-to-byron-bay-drive': 'Australia',
  'hoi-an-ancient-town-walk': 'Hội An, Vietnam',
  'hai-van-pass-da-nang-loop': 'Đà Nẵng, Vietnam',
  'hanoi-old-quarter-food-walk': 'Hà Nội, Vietnam',
};

function parseEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

const rootEnv = parseEnv(join(ROOT, '.env'));
const localEnv = parseEnv(join(HERE, '.env'));
const env = (k) => process.env[k] ?? localEnv[k] ?? rootEnv[k] ?? '';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt('--only');

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const data = JSON.parse(readFileSync(join(HERE, 'trips.json'), 'utf8'));
const trips = data.trips.filter((t) => !only || t.slug === only);
if (only && trips.length === 0) fail(`No trip with slug "${only}"`);

function haversineM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Same normalisation as normalizeText() in src/lib/trip-form.ts
function normalizeText(t) {
  const v = String(t ?? '').trim().replace(/\n{3,}/g, '\n\n');
  return v.length > 0 ? v : null;
}

/** Returns a list of validation problems for one trip. */
function validateTrip(t) {
  const p = [];
  const title = (t.title ?? '').trim();
  if (typeof t.slug !== 'string' || !SLUG_RE.test(t.slug)) p.push('slug must match ' + SLUG_RE);
  if (title.length < 1 || title.length > TITLE_MAX) p.push(`title length ${title.length} (1-${TITLE_MAX})`);
  const desc = t.description ?? '';
  // Reserve room for the appended photo credit line (about 200 chars).
  if (desc.length + 200 > TEXT_MAX) p.push(`description ${desc.length} chars leaves no room for the credit (max ${TEXT_MAX})`);
  if (!MODES.includes(t.travel_mode)) p.push(`bad travel_mode ${t.travel_mode}`);
  if (!VISIBILITIES.includes(t.visibility)) p.push(`bad visibility ${t.visibility}`);
  if (!t.cover_query) p.push('missing cover_query');
  if (!Array.isArray(t.stops) || t.stops.length < 1 || t.stops.length > MAX_STOPS) {
    p.push(`stops count ${t.stops?.length} (1-${MAX_STOPS})`);
  }
  (t.stops ?? []).forEach((s, i) => {
    const n = (s.name ?? '').trim();
    if (n.length < 1 || n.length > STOP_NAME_MAX) p.push(`stop ${i + 1} name length ${n.length}`);
    if ((s.notes ?? '').length > TEXT_MAX) p.push(`stop ${i + 1} notes too long`);
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng) || Math.abs(s.lat) > 90 || Math.abs(s.lng) > 180) {
      p.push(`stop ${i + 1} invalid lat/lng`);
    }
  });
  return p;
}

// ---------------------------------------------------------------- verify
async function verify() {
  const contact = env('NOMINATIM_CONTACT_EMAIL');
  const ua = `onMyWay-seed/1.0${contact ? ` (${contact})` : ''}`;
  const rows = [];
  let invalid = 0;
  let lastReq = 0;
  for (const t of trips) {
    const problems = validateTrip(t);
    if (problems.length) {
      invalid += 1;
      console.log(`[INVALID] ${t.slug}: ${problems.join('; ')}`);
    }
    const region = REGIONS[t.slug] ?? '';
    for (const [i, s] of (t.stops ?? []).entries()) {
      // Optional `geocode_query` in trips.json overrides the default "<name>, <region>" (ignored by `seed`).
      const q = s.geocode_query ?? (region ? `${s.name}, ${region}` : s.name);
      const wait = 1100 - (Date.now() - lastReq);
      if (wait > 0) await sleep(wait);
      lastReq = Date.now();
      const row = { slug: t.slug, stop: i + 1, name: s.name, found: '', distanceM: null, flag: '', suggestion: null };
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const [hit] = await res.json();
        if (!hit) {
          row.flag = 'NOT FOUND';
        } else {
          const pt = { lat: Number(hit.lat), lng: Number(hit.lon) };
          row.found = String(hit.display_name).slice(0, 60);
          row.distanceM = Math.round(haversineM(s, pt));
          row.suggestion = pt;
          if (row.distanceM > 300) row.flag = 'FLAG >300m';
        }
      } catch (e) {
        row.flag = `ERROR ${e.message}`;
      }
      rows.push(row);
      console.log(
        `${row.slug.slice(0, 30).padEnd(30)} ${String(row.stop).padStart(2)} ${s.name.slice(0, 34).padEnd(34)} ${String(row.distanceM ?? '-').padStart(7)} m  ${row.flag}`,
      );
    }
  }
  writeFileSync(join(HERE, 'verify-report.json'), JSON.stringify(rows, null, 2));
  const flagged = rows.filter((r) => r.flag);
  console.log(`\n${rows.length} stops checked, ${flagged.length} flagged, ${invalid} trips with schema problems.`);
  console.log('Report written to scripts/seed-official/verify-report.json (trips.json is never modified).');
  if (invalid) process.exitCode = 1;
}

// ---------------------------------------------------------------- fetch-covers
/** Covers folder of a slug; throws unless the slug is safe and the resolved path stays inside covers/. */
function coverDir(slug) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) throw new Error(`unsafe slug: ${slug}`);
  const root = resolve(COVERS);
  const dir = resolve(root, slug);
  if (!dir.startsWith(root + sep)) throw new Error(`slug escapes covers/: ${slug}`);
  return dir;
}

async function download(url, file) {
  if (!String(url).toLowerCase().startsWith('https://')) throw new Error('refusing non-https URL');
  const res = await fetch(url, { headers: { 'User-Agent': 'onMyWay-seed/1.0' }, redirect: 'follow' });
  if (!res.url.startsWith('https://')) throw new Error('refusing non-https redirect');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('jpeg') && !type.includes('jpg')) throw new Error(`not a JPEG (${type})`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, buf);
  return buf.length;
}

async function fetchCovers() {
  for (const t of trips) coverDir(t.slug); // fail fast on unsafe slugs
  for (const t of trips) {
    const dir = coverDir(t.slug);
    mkdirSync(dir, { recursive: true });
    // Long queries often return nothing: retry with fewer words until there are enough results.
    const words = t.cover_query.split(/\s+/);
    const queries = [...new Set([words.length, 4, 3, 2].filter((n) => n <= words.length).map((n) => words.slice(0, n).join(' ')))];
    const results = [];
    const seen = new Set();
    for (const q of queries) {
      if (results.length >= 5) break;
      try {
        const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&page_size=5`;
        const res = await fetch(api, {
          headers: { 'User-Agent': 'onMyWay-seed/1.0', Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        for (const r of (await res.json()).results ?? []) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            results.push(r);
          }
        }
      } catch (e) {
        console.log(`${t.slug}: Openverse search "${q}" failed (${e.message})`);
      }
    }
    const credits = [];
    for (const r of results) {
      if (credits.length >= 3) break;
      const file = `${credits.length + 1}.jpg`;
      // Prefer the original; fall back to Openverse's thumbnail (about 600 px wide) when it fails.
      let size = null;
      let variant = 'original';
      try {
        size = await download(r.url, join(dir, file));
        if (size > 8 * 1024 * 1024) throw new Error('over 8 MB');
      } catch {
        try {
          variant = 'thumbnail';
          size = await download(r.thumbnail, join(dir, file));
        } catch (e) {
          console.log(`  skip "${r.title}": ${e.message}`);
          continue;
        }
      }
      credits.push({
        file,
        variant,
        bytes: size,
        title: r.title || 'Untitled',
        creator: r.creator || 'Unknown',
        license: `${String(r.license ?? '').toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`.trim(),
        license_url: r.license_url ?? null,
        source_url: r.foreign_landing_url ?? r.url,
        image_url: r.url,
      });
    }
    writeFileSync(join(dir, 'credits.json'), JSON.stringify(credits, null, 2));
    console.log(
      `${t.slug}: ${credits.length} candidate(s) -> ${credits.map((c) => `${c.file} (${c.variant}, ${Math.round(c.bytes / 1024)} KB)`).join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------- seed
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

function loadCover(slug) {
  const dir = coverDir(slug);
  const coverFile = join(dir, 'cover.jpg');
  // No cover.jpg = intentionally no cover: the trip is created without cover_path (the app shows a gradient).
  if (!existsSync(coverFile)) return { none: true };
  const bytes = readFileSync(coverFile);
  let credits = [];
  try {
    credits = JSON.parse(readFileSync(join(dir, 'credits.json'), 'utf8'));
  } catch {
    return { error: `covers/${slug}/credits.json missing` };
  }
  const hash = sha(bytes);
  const match = credits.find((c) => existsSync(join(dir, c.file)) && sha(readFileSync(join(dir, c.file))) === hash);
  if (!match) return { error: 'cover.jpg matches no candidate: COPY (do not rename) the chosen N.jpg to cover.jpg' };
  return { bytes, credit: `Cover photo: ${match.title} by ${match.creator}, ${match.license}` };
}

async function seed() {
  const { createClient } = await import('@supabase/supabase-js');
  const dry = flag('--dry-run');
  const routesOnly = flag('--routes-only');
  const url = env('EXPO_PUBLIC_SUPABASE_URL');
  const anon = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) fail('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing in root .env');

  // Validate and check covers before touching the network.
  const plans = trips.map((t) => {
    const problems = validateTrip(t);
    const cover = routesOnly ? null : loadCover(t.slug);
    if (cover?.error) problems.push(cover.error);
    return { t, cover, problems };
  });
  const bad = plans.filter((p) => p.problems.length);
  if (dry) {
    for (const p of plans) {
      console.log(`[dry-run] ${p.t.slug}: ${p.problems.length ? `NOT READY - ${p.problems.join('; ')}` : 'ready'}${p.cover?.none ? ' - no cover (gradient)' : ''} (${p.t.stops.length} stops)`);
    }
    return;
  }
  if (bad.length) {
    for (const p of bad) console.error(`${p.t.slug}: ${p.problems.join('; ')}`);
    fail('Fix the problems above (or use --only <slug>).');
  }

  const email = env('SEED_EMAIL');
  const password = env('SEED_PASSWORD');
  if (!email || !password) fail('SEED_EMAIL / SEED_PASSWORD missing in scripts/seed-official/.env');
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: true } });
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr || !auth.user) fail(`sign-in failed: ${authErr?.message}`);
  const userId = auth.user.id;
  const { data: prof } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
  if (prof && prof.username !== data.account.username) {
    console.warn(`WARNING: signed in as @${prof.username}, expected @${data.account.username}`);
  }

  // Route throttle: 5 per 10 minutes per user. Sliding window with a safety margin.
  const routeTimes = [];
  const callRoute = async (tripId) => {
    while (routeTimes.length >= 5) {
      const wait = routeTimes[0] + 10 * 60_000 + 5_000 - Date.now();
      if (wait > 0) {
        console.log(`  waiting ${Math.ceil(wait / 1000)}s for the route throttle...`);
        await sleep(wait);
      }
      routeTimes.shift();
    }
    routeTimes.push(Date.now());
    const { data: body, error } = await supabase.functions.invoke('compute-trip-route', {
      body: { trip_id: tripId },
      timeout: 60_000,
    });
    if (error || !body) return { status: 'error', detail: error?.message ?? 'no response' };
    return { status: body.status ?? 'error', reason: body.reason ?? null };
  };
  const readRoute = async (tripId) => {
    const { data: r } = await supabase.rpc('get_trip_route', { p_trip_id: tripId });
    const row = Array.isArray(r) ? r[0] : r;
    return row ? { status: row.is_fresh ? row.route_status : null, distanceM: row.distance_m ?? null } : null;
  };

  const summary = [];
  for (const { t, cover } of plans) {
    const title = t.title.trim();
    console.log(`\n== ${t.slug}`);
    const { data: existing, error: exErr } = await supabase
      .from('trips')
      .select('id')
      .eq('owner_id', userId)
      .eq('title', title)
      .limit(1);
    if (exErr) {
      console.error(`  lookup failed: ${exErr.message}`);
      summary.push({ slug: t.slug, tripId: '-', result: 'lookup failed' });
      continue;
    }
    let tripId = existing?.[0]?.id;

    if (routesOnly) {
      if (!tripId) {
        console.log('  not created yet, skipped');
        summary.push({ slug: t.slug, tripId: '-', result: 'missing (run seed first)' });
        continue;
      }
    } else if (tripId) {
      console.log(`  already exists (${tripId}), skipped`);
      summary.push({ slug: t.slug, tripId, result: 'skipped (exists)' });
      continue;
    } else {
      tripId = randomUUID();
      const description = cover.none
        ? normalizeText(t.description)
        : normalizeText(`${normalizeText(t.description) ?? ''}\n\n${cover.credit}`);
      // 1. Private trip row (publishTrip step 1)
      const ins = await supabase.from('trips').insert({
        id: tripId,
        owner_id: userId,
        title,
        description,
        visibility: 'private',
        travel_mode: t.travel_mode,
      });
      if (ins.error) {
        console.error(`  trip insert failed: ${ins.error.message}`);
        summary.push({ slug: t.slug, tripId, result: 'insert failed' });
        continue;
      }
      // 2. Cover upload to {uid}/{tripId}/{fileId}.jpg, then trips.cover_path
      const coverPath = `${userId}/${tripId}/${randomUUID()}.jpg`;
      const up = cover.none
        ? { error: null }
        : await supabase.storage.from(BUCKET).upload(coverPath, cover.bytes, { contentType: 'image/jpeg', upsert: false });
      if (up.error) {
        console.error(`  cover upload failed: ${up.error.message} (private trip ${tripId} left behind; delete it in the app before re-running)`);
        summary.push({ slug: t.slug, tripId, result: 'cover upload failed' });
        continue;
      }
      const cp = cover.none
        ? { data: true, error: null }
        : await supabase.from('trips').update({ cover_path: coverPath }).eq('id', tripId).select('id').maybeSingle();
      if (cp.error || !cp.data) {
        console.error(`  cover_path update failed: ${cp.error?.message ?? 'no row'}`);
        summary.push({ slug: t.slug, tripId, result: 'cover_path failed' });
        continue;
      }
      // 3. Stops in one atomic RPC
      const stops = t.stops.map((s) => ({
        id: randomUUID(),
        name: s.name.trim(),
        lat: s.lat,
        lng: s.lng,
        address: null,
        notes: normalizeText(s.notes),
        photos: [],
      }));
      const rpc = await supabase.rpc('save_trip_stops', { p_trip_id: tripId, p_stops: stops });
      if (rpc.error) {
        console.error(`  save_trip_stops failed: ${rpc.error.message}`);
        summary.push({ slug: t.slug, tripId, result: 'stops failed' });
        continue;
      }
    }

    // 4. Road route
    const route = await callRoute(tripId);
    console.log(`  route: ${route.status}${route.reason ? ` (${route.reason})` : ''}${route.detail ? ` ${route.detail}` : ''}`);

    // 5. Visibility last (the trip stays private until everything worked)
    if (!routesOnly) {
      const vis = await supabase.from('trips').update({ visibility: t.visibility }).eq('id', tripId).select('id').maybeSingle();
      if (vis.error || !vis.data) {
        console.error(`  visibility update failed: ${vis.error?.message ?? 'no row'}`);
        summary.push({ slug: t.slug, tripId, result: 'visibility failed' });
        continue;
      }
    }
    const info = await readRoute(tripId);
    summary.push({
      slug: t.slug,
      tripId,
      result: routesOnly ? 'route recomputed' : 'created',
      route: info?.status ?? route.status,
      distanceKm: info?.distanceM != null ? (info.distanceM / 1000).toFixed(1) : '-',
    });
  }
  console.log('\n== Summary');
  console.table(summary);
  console.log('Trips whose route is "error" can be retried later with: seed --routes-only');
}

if (cmd === 'verify') await verify();
else if (cmd === 'fetch-covers') await fetchCovers();
else if (cmd === 'seed') await seed();
else fail('Usage: node scripts/seed-official/seed.mjs <verify|fetch-covers|seed> [--only <slug>] [--dry-run] [--routes-only]');
