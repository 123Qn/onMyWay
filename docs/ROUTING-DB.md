# Road routing: database design and Edge Function contract

Migration: `supabase/migrations/0004_trip_routes.sql` (rollback: `.down.sql`, dev only).
Not applied to any remote database yet. UI spec: `docs/ROUTING.md`.

## 1. Decisions

| Topic | Decision | Why |
|---|---|---|
| Travel mode | `trips.travel_mode text not null default 'driving' check in (driving, walking, cycling)` | Project style (text + check, like `visibility`). Old trips get `driving`. Editable through the existing `trips_update` policy. |
| Route storage | Separate table `trip_routes` (PK = `trip_id`, 0..1 row per trip) recording the LAST ATTEMPT (ok, none or error) | The polyline (up to about 12 KB) stays out of `trips`, which feeds the feed/profile/detail. The route has its own lifecycle (recomputed, failed, stale) and its own RLS. No row = never computed. |
| Outcome persisted | `status` ok / none / error + `reason` no_route / too_far / unavailable | The owner UI needs to know that a past attempt failed and why ("Try again" vs "Edit trip"), and edit-save must skip recompute after a fresh `none`. |
| Format | Google encoded polyline, precision 5, lat/lng order, simplified by the Edge Function to at most 2,000 points | Small; react-native-maps needs a small decode step (coder). |
| Staleness | `stops_hash` = sha256 of `mode \n lat,lng;lat,lng...` (6 decimals, ordered by position), computed in SQL by `trip_route_signature()`. `get_trip_route()` returns NULL status and geometry when the stored hash no longer matches. | Guarantee lives in the DB: a stale line can never be returned. Covers stop edits AND mode changes (which happen via plain `trips` update, so clearing inside `save_trip_stops` could not catch them). `save_trip_stops` is left unchanged; no coupling. |
| Who writes | Edge Function using the CALLER's JWT (anon key + `Authorization` header) via RPC `save_trip_route`. NO service_role. | RLS owner policies already express the rule; ownership is verified by the DB. |
| Throttle | `claim_route_request()` (SECURITY DEFINER) + `route_requests` log | Section 4. |

Residual risk of the JWT approach: the owner could write a fake `ok` row for THEIR OWN trip straight through PostgREST. It needs a valid hash and must satisfy the shape CHECK; the impact is limited to their own trip content (same trust level as notes), size is capped, and it never costs ORS quota. The stricter alternative (no write policies, service_role only) was rejected because it puts the powerful key into the function for little gain. `save_trip_route` is the intended path and takes mode and stop_count from the DB.

## 2. Schema

`trip_routes`: `trip_id` (PK, FK trips ON DELETE CASCADE), `status` (`ok|none|error`), `reason` (`no_route|too_far|unavailable`), `travel_mode`, `polyline`, `distance_m int`, `duration_s int`, `stop_count` (2..20), `stops_hash` (64 hex), `computed_at`.
CHECK `trip_routes_shape_chk`: `ok` => polyline/distance/duration present, reason null; `none` => those null, reason `no_route|too_far`; `error` => those null, reason `unavailable`.
Rows exist only for trips with 2+ stops. The PK covers every lookup; no extra index.

`route_requests` (throttle log): `id`, `user_id` (FK profiles, cascade), `trip_id` (FK, set null), `requested_at`. Indexes `(user_id, requested_at desc)` and `(requested_at desc)` serve the window counts. RLS on, no policies, all grants revoked: clients cannot read, forge or erase it. Growth is at most about 2,000 small rows/day; optional pg_cron prune of rows older than 7 days later.

### RLS on trip_routes
- SELECT: `exists (select 1 from trips t where t.id = trip_id)`. Trips RLS applies inside, so any row (ok, none, error) is visible exactly when its trip is (public, or own private). Non-owners just ignore none/error.
- INSERT/UPDATE/DELETE: trip owner only.
- `anon`: nothing (login wall, as in 0001).

## 3. Size limits

| Limit | Value | Enforced by |
|---|---|---|
| Stops per routing request | 20 (existing trip limit; ORS allows 50 waypoints) | trigger from 0001; `stop_count` CHECK |
| Minimum stops | 2 | function returns `NOT_ENOUGH_STOPS`; `save_trip_route` raises 22023 |
| Polyline | at most 2,000 points (function simplifies, e.g. Douglas-Peucker); length 2..40,000 chars | function + CHECK |
| distance_m / duration_s | 0..20,000,000 / 0..8,640,000 | CHECK |
| ORS response size | reject bodies over about 2 MB before parsing | Edge Function |
| ORS distance caps (verify against current ORS docs): foot-walking is limited to roughly 100 km per request on the public API | n/a | ORS 400 (codes 2003/2004) -> stored as `none/too_far` |

If the encoded polyline still exceeds 40,000 chars after simplification, store `none/no_route` (should not happen).

## 4. Rate limiting (inside `claim_route_request`)

- Per user: 5 per 10 minutes and 30 per rolling 24 h.
- Global: 1,800 per rolling 24 h (ORS free tier 2,000/day, 10 percent headroom). ORS also caps per minute (about 40/min on free); map ORS 429 to `error/unavailable`.
- A per-user advisory transaction lock serialises parallel claims of one user. The global cap has a tiny cross-user race; headroom covers it.
- Cached results (fresh `ok` or `none`) are returned BEFORE claiming, so repeated calls on unchanged trips cost no quota. A fresh `error` is deliberately not cached: "Try again" must be able to retry (it is still throttled).
- A failed ORS call still consumes a claim (conservative, prevents retry storms).
- SECURITY DEFINER only here: the global count must see all users' rows. It trusts only `p_trip_id`, verifies `owner_id = auth.uid()` itself, only inserts for `auth.uid()`, `search_path = ''`.
- The function should set a 10 s timeout on ORS and never log the ORS key or full coordinates.

## 5. Edge Function contract: `compute-trip-route`

Secrets: `ORS_API_KEY` (`supabase secrets set`). Never in the app or repo. `SUPABASE_URL` / `SUPABASE_ANON_KEY` come from the runtime. Do NOT use `SUPABASE_SERVICE_ROLE_KEY`. JWT verification stays ON. The Supabase client is built with the anon key and the request's `Authorization` header so every query runs as the user.

Request: `POST /functions/v1/compute-trip-route`, JSON `{ "trip_id": "<uuid>" }`. Nothing else is read (no coordinates, no mode).

Flow:
1. Validate `trip_id` is a uuid (else `BAD_REQUEST`).
2. `rpc('get_trip_routing_input')` -> 0 rows = `NOT_FOUND` (missing or not owner; indistinguishable on purpose). `stop_count < 2` = `NOT_ENOUGH_STOPS` (nothing stored).
3. Cache check via `get_trip_route`: if `is_fresh` and `route_status` is `ok` or `none` -> return it, `cached: true`, no ORS call, no quota.
4. `rpc('claim_route_request')`. On `RATE_LIMITED_USER` / `RATE_LIMITED_GLOBAL`: record `error/unavailable` (step 6) and return it.
5. Call ORS `POST https://api.openrouteservice.org/v2/directions/{profile}` (driving-car / foot-walking / cycling-regular) with `coords` from step 2 (already `[lng,lat]`). Map: success -> `ok` (decode, simplify to <= 2,000 points, re-encode); ORS 404 / code 2010 (cannot snap) or no route -> `none/no_route`; distance or waypoint limit -> `none/too_far`; 429, 5xx, timeout, network -> `error/unavailable`.
6. `rpc('save_trip_route', {p_trip_id, p_status, p_reason, p_polyline, p_distance_m, p_duration_s, p_stops_hash})` with the hash from step 2 (nulls for non-ok). `false` means stops/mode changed meanwhile -> `STALE_INPUT` (409), client calls again.
7. Respond.

Every routing outcome, including failures, is HTTP 200:
```json
{ "status": "ok|none|error", "reason": null, "distance_m": 12345, "duration_s": 1800, "cached": false }
```
`reason` is `no_route | too_far | unavailable`, null when ok. The geometry is not in this response; the app reads it with `get_trip_route`.

Other errors: HTTP status + `{ "error": { "code", "message" } }`; nothing is stored; the app treats them as `error/unavailable` and falls back to straight lines.

| code | HTTP | meaning |
|---|---|---|
| BAD_REQUEST | 400 | missing/invalid trip_id |
| UNAUTHENTICATED | 401 | no/invalid JWT |
| NOT_FOUND | 404 | trip missing or caller is not owner |
| NOT_ENOUGH_STOPS | 422 | fewer than 2 stops |
| STALE_INPUT | 409 | stops/mode changed during computation; retry |
| INTERNAL | 500 | anything else |

Rate limit and ORS outage are `200 {status:'error', reason:'unavailable'}` and persisted, so the owner sees "Try again".

## 6. Read path for the app

`supabase.rpc('get_trip_route', { p_trip_id })` returns 0 or 1 row:
`trip_id, travel_mode (CURRENT trip mode), route_status, reason, polyline, distance_m, duration_s, computed_at, is_fresh`.
- 0 rows: never computed -> straight lines, status treated as null.
- `is_fresh = false`: stops or mode changed since the attempt. The DB returns `route_status`, `reason` and geometry as NULL, so nothing stale is drawn.
- Fresh: `ok` -> draw polyline; `none` + reason -> owner notice "Edit trip"; `error` -> owner notice "Try again".
- `needsRoute` = 2+ stops AND (`route_status` is null OR `error`). A fresh `none` is never recomputed.
No N+1: one call per trip detail and per edit load; do not call it in the feed.

## 7. Code the coder must update

1. Owner applies migration 0004 in the SQL editor, then `npm run gen:types`. Types were hand-edited; note `save_trip_route` args `p_polyline, p_reason, p_distance_m, p_duration_s` are nullable but required (pass null explicitly), and the generator may emit them as `string`/`number`.
2. Trip create/edit: write `travel_mode` on `trips`. After `save_trip_stops` succeeds, and only if `needsRoute`, invoke `compute-trip-route`; never block saving; map non-200 or timeout to `error/unavailable` in the UI.
3. Trip detail: fetch `get_trip_route`, decode polyline, draw when `ok`; owner notices per status.
4. App `TravelMode`, `RouteStatus`, `RouteReason` union types.
5. Edge Function `supabase/functions/compute-trip-route` per section 5 (separate task).

## 8. Concurrency notes

- `save_trip_route` locks the trip row (`FOR UPDATE`), the same lock `save_trip_stops` takes, so route write and stop save serialise. A slow ORS call that finishes after an edit is discarded by the hash check.
- Concurrent computes of one trip: last valid write wins via upsert on the PK; same input gives the same hash.
- `get_trip_routing_input` is one SQL statement, so coords, mode and hash share a snapshot.
- The function flow spans an external HTTP call and cannot be one transaction; the hash guard compensates.
