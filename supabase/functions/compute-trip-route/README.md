# compute-trip-route

Computes a road route (OpenRouteService Directions v2) for a trip and stores it through
`save_trip_route`. Contract: `docs/ROUTING-DB.md` section 5. Requires migration `0004_trip_routes.sql`.

Runs with the caller's JWT (anon key + Authorization header, RLS applies). It never uses the
service_role key. JWT verification stays ON (default; do not pass `--no-verify-jwt`).

## Secret

```
supabase secrets set ORS_API_KEY=<your openrouteservice key>
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by the Supabase runtime.

## Deploy

```
supabase functions deploy compute-trip-route --project-ref <ref>
```

## Local

Put `ORS_API_KEY=...` in an untracked `supabase/functions/.env`, then:

```
supabase start
supabase functions serve compute-trip-route --env-file supabase/functions/.env
```

Request: `POST /functions/v1/compute-trip-route` with `Authorization: Bearer <user jwt>`
and body `{"trip_id":"<uuid>"}`.

## Notes

- ORS timeout 15 s; response capped at 2 MB; geometry reduced to <= 2,000 points
  (Douglas-Peucker ranking) and re-encoded at precision 5.
- Logs contain only status and error codes, never the key or coordinates.
