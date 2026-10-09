// compute-trip-route: computes a road route with OpenRouteService and stores it.
// Contract: docs/ROUTING-DB.md section 5. Runs with the CALLER's JWT (RLS applies);
// the service_role key is never used.
import { createClient } from "npm:@supabase/supabase-js@2";
import { decodePolyline, encodePolyline, reducePoints } from "./polyline.ts";

const MAX_POINTS = 2000;
const MAX_POLYLINE_CHARS = 40000;
const MAX_ORS_BYTES = 2 * 1024 * 1024;
const MAX_BODY_CHARS = 1024;
const ORS_TIMEOUT_MS = 15_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROFILES: Record<string, string> = {
  driving: "driving-car",
  walking: "foot-walking",
  cycling: "cycling-regular",
};

const CORS = {
  // Native clients ignore CORS; auth is the JWT, not the origin.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Status = "ok" | "none" | "error";
type Reason = "no_route" | "too_far" | "unavailable";
type Outcome = {
  status: Status;
  reason: Reason | null;
  polyline: string | null;
  distance_m: number | null;
  duration_s: number | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function fail(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

const outcomeResponse = (o: Outcome, cached: boolean) =>
  json({
    status: o.status,
    reason: o.reason,
    distance_m: o.distance_m,
    duration_s: o.duration_s,
    cached,
  });

const failed = (reason: Reason): Outcome => ({
  status: "error", reason, polyline: null, distance_m: null, duration_s: null,
});
const none = (reason: "no_route" | "too_far"): Outcome => ({
  status: "none", reason, polyline: null, distance_m: null, duration_s: null,
});

/** Reads a body as text, returning null when it exceeds `cap` bytes. */
async function readCapped(res: Response, cap: number): Promise<string | null> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > cap) return null;
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

/** Calls ORS and maps every result to an Outcome. Never throws. */
async function callOrs(mode: string, coords: unknown): Promise<Outcome> {
  const key = Deno.env.get("ORS_API_KEY");
  const profile = PROFILES[mode];
  if (!key || !profile) {
    console.error("routing: ORS key or profile missing");
    return failed("unavailable");
  }
  let res: Response;
  try {
    res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ coordinates: coords, instructions: false }),
      signal: AbortSignal.timeout(ORS_TIMEOUT_MS),
    });
  } catch (_e) {
    console.error("routing: ORS network error or timeout");
    return failed("unavailable");
  }

  const text = await readCapped(res, MAX_ORS_BYTES).catch(() => null);
  if (text === null) {
    console.error(`routing: ORS body unreadable or too large (HTTP ${res.status})`);
    return failed("unavailable");
  }
  // deno-lint-ignore no-explicit-any
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch (_e) {
    // handled below
  }

  if (!res.ok) {
    const code = Number(data?.error?.code);
    console.error(`routing: ORS HTTP ${res.status} code ${Number.isFinite(code) ? code : "n/a"}`);
    if (code === 2004) return none("too_far"); // exceeds distance / waypoint limit
    if (code === 2009 || code === 2010 || res.status === 404) return none("no_route");
    return failed("unavailable"); // 401/403 key, 429, 5xx, other 400
  }

  const route = data?.routes?.[0];
  const dist = route?.summary?.distance;
  const dur = route?.summary?.duration;
  if (typeof route?.geometry !== "string" || typeof dist !== "number" || typeof dur !== "number") {
    return none("no_route");
  }
  try {
    const pts = reducePoints(decodePolyline(route.geometry), MAX_POINTS);
    if (pts.length < 2) return none("no_route");
    const polyline = encodePolyline(pts);
    if (polyline.length > MAX_POLYLINE_CHARS) return none("no_route");
    return {
      status: "ok",
      reason: null,
      polyline,
      distance_m: Math.round(dist),
      duration_s: Math.round(dur),
    };
  } catch (_e) {
    return none("no_route");
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("BAD_REQUEST", "POST only", 400);

  try {
    const authHeader = req.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authHeader?.startsWith("Bearer ")) {
      return fail("UNAUTHENTICATED", "Sign in required", 401);
    }
    if (!url || !anon) return fail("INTERNAL", "Server misconfigured", 500);

    // 1. validate body: exactly {trip_id: uuid}
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return fail("BAD_REQUEST", "Invalid body", 400);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch (_e) {
      return fail("BAD_REQUEST", "Invalid JSON", 400);
    }
    if (
      typeof body !== "object" || body === null || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !("trip_id" in body)
    ) {
      return fail("BAD_REQUEST", "Body must be {trip_id}", 400);
    }
    const tripId = (body as { trip_id: unknown }).trip_id;
    if (typeof tripId !== "string" || !UUID_RE.test(tripId)) {
      return fail("BAD_REQUEST", "trip_id must be a uuid", 400);
    }

    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.slice(7),
    );
    if (userErr || !userData?.user) return fail("UNAUTHENTICATED", "Invalid session", 401);

    // 2. routing input (owner only)
    const { data: input, error: inErr } = await supabase.rpc("get_trip_routing_input", {
      p_trip_id: tripId,
    });
    if (inErr) {
      console.error("routing: get_trip_routing_input failed", inErr.code);
      return fail("INTERNAL", "Internal error", 500);
    }
    const row = input?.[0];
    if (!row) return fail("NOT_FOUND", "Trip not found", 404);
    if (row.stop_count < 2) {
      return fail("NOT_ENOUGH_STOPS", "A route needs at least 2 stops", 422);
    }

    // 3. cache: fresh ok/none costs no quota
    const { data: cur, error: curErr } = await supabase.rpc("get_trip_route", {
      p_trip_id: tripId,
    });
    if (curErr) {
      console.error("routing: get_trip_route failed", curErr.code);
      return fail("INTERNAL", "Internal error", 500);
    }
    const c = cur?.[0];
    if (c?.is_fresh && (c.route_status === "ok" || c.route_status === "none")) {
      return outcomeResponse({
        status: c.route_status,
        reason: c.reason ?? null,
        polyline: null,
        distance_m: c.distance_m ?? null,
        duration_s: c.duration_s ?? null,
      }, true);
    }

    // 4. throttle, then 5. ORS
    let outcome: Outcome;
    const { error: claimErr } = await supabase.rpc("claim_route_request", {
      p_trip_id: tripId,
    });
    if (claimErr) {
      if (
        claimErr.message === "RATE_LIMITED_USER" ||
        claimErr.message === "RATE_LIMITED_GLOBAL"
      ) {
        outcome = failed("unavailable");
      } else if (claimErr.code === "42501") {
        return fail("NOT_FOUND", "Trip not found", 404);
      } else {
        console.error("routing: claim_route_request failed", claimErr.code);
        return fail("INTERNAL", "Internal error", 500);
      }
    } else {
      outcome = await callOrs(row.travel_mode, row.coords);
    }

    // 6. persist (hash guard against concurrent edits)
    const { data: saved, error: saveErr } = await supabase.rpc("save_trip_route", {
      p_trip_id: tripId,
      p_status: outcome.status,
      p_reason: outcome.reason,
      p_polyline: outcome.polyline,
      p_distance_m: outcome.distance_m,
      p_duration_s: outcome.duration_s,
      p_stops_hash: row.stops_hash,
    });
    if (saveErr) {
      console.error("routing: save_trip_route failed", saveErr.code);
      if (saveErr.code === "42501") return fail("NOT_FOUND", "Trip not found", 404);
      return fail("INTERNAL", "Internal error", 500);
    }
    if (saved === false) return fail("STALE_INPUT", "Trip changed, retry", 409);

    // 7. respond
    return outcomeResponse(outcome, false);
  } catch (_e) {
    console.error("routing: unexpected error");
    return fail("INTERNAL", "Internal error", 500);
  }
});
