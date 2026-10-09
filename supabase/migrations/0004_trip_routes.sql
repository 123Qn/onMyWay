-- =============================================================================
-- 0004_trip_routes.sql : travel mode per trip + stored road route + routing throttle
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
--   Run it ONCE (not idempotent). Requires 0001..0003 applied first.
--   Afterwards regenerate types:  npm run gen:types
--   Dev-only rollback: 0004_trip_routes.down.sql
--   Design + Edge Function contract: docs/ROUTING-DB.md
--
-- Adds
--   trips.travel_mode            'driving' | 'walking' | 'cycling' (creator's choice)
--   trip_routes                  0..1 stored route per trip (encoded polyline etc.)
--   route_requests               throttle log, written ONLY by claim_route_request()
--   trip_route_signature()       sha256 of mode + ordered stop coords (stale detection)
--   get_trip_route()             what the app reads when VIEWING a trip
--   get_trip_routing_input()     what the Edge Function reads (owner only, one snapshot)
--   claim_route_request()        per-user + global rate limit, called by the Edge Function
--   save_trip_route()            race-safe write of the computed route (owner only)
-- All functions are SECURITY INVOKER (RLS applies) except claim_route_request,
-- which must count other users' rows for the global ORS quota.
-- =============================================================================

begin;

-- ---------- trips.travel_mode ----------
alter table public.trips
  add column travel_mode text not null default 'driving'
  check (travel_mode in ('driving','walking','cycling'));

-- ---------- trip_routes (separate table, see docs/ROUTING-DB.md) ----------
create table public.trip_routes (
  trip_id     uuid primary key references public.trips(id) on delete cascade,
  status      text not null check (status in ('ok','none','error')),
  -- none : ORS answered, no route ('no_route') or too far for the mode ('too_far')
  -- error: transient, service down / quota / timeout ('unavailable')
  reason      text check (reason in ('no_route','too_far','unavailable')),
  travel_mode text not null check (travel_mode in ('driving','walking','cycling')),
  -- Google encoded polyline, precision 5, lat/lng order, simplified by the Edge
  -- Function to <= 2000 points (about 12 KB; hard cap 40000 chars).
  polyline    text check (char_length(polyline) between 2 and 40000),
  distance_m  integer check (distance_m between 0 and 20000000),
  duration_s  integer check (duration_s between 0 and 8640000),
  stop_count  integer not null check (stop_count between 2 and 20),
  -- trip_route_signature() at the moment the stops were read. Row is valid
  -- iff this equals the CURRENT signature of the trip.
  stops_hash  text not null check (stops_hash ~ '^[0-9a-f]{64}$'),
  computed_at timestamptz not null default now(),
  constraint trip_routes_shape_chk check (
    (status = 'ok'    and polyline is not null and distance_m is not null
                      and duration_s is not null and reason is null)
 or (status = 'none'  and polyline is null and distance_m is null
                      and duration_s is null and reason in ('no_route','too_far'))
 or (status = 'error' and polyline is null and distance_m is null
                      and duration_s is null and reason = 'unavailable'))
);

-- ---------- route_requests (throttle log; no client access at all) ----------
create table public.route_requests (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  trip_id      uuid references public.trips(id) on delete set null,
  requested_at timestamptz not null default now()
);
create index route_requests_user_time_idx on public.route_requests (user_id, requested_at desc);
create index route_requests_time_idx      on public.route_requests (requested_at desc);

-- ---------- RLS ----------
alter table public.trip_routes    enable row level security;
alter table public.route_requests enable row level security;

-- Readers see a route exactly when they can see the trip (trips RLS is applied
-- inside the subquery: public trips, or own private trips).
create policy trip_routes_select on public.trip_routes for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_routes.trip_id));
-- Only the owner writes (the Edge Function acts with the caller's JWT, no service_role).
create policy trip_routes_insert on public.trip_routes for insert to authenticated
  with check (exists (select 1 from public.trips t
                      where t.id = trip_routes.trip_id and t.owner_id = (select auth.uid())));
create policy trip_routes_update on public.trip_routes for update to authenticated
  using (exists (select 1 from public.trips t
                 where t.id = trip_routes.trip_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t
                      where t.id = trip_routes.trip_id and t.owner_id = (select auth.uid())));
create policy trip_routes_delete on public.trip_routes for delete to authenticated
  using (exists (select 1 from public.trips t
                 where t.id = trip_routes.trip_id and t.owner_id = (select auth.uid())));

-- route_requests: RLS on, NO policies, and no grants => users cannot read/forge/erase it.
revoke all on public.route_requests from anon, authenticated;
revoke all on public.trip_routes    from anon;

-- ---------- signature of the routing input ----------
-- sha256( travel_mode \n "lat,lng;lat,lng;..." ) with coords rounded to 6 decimals
-- (~0.1 m), stops ordered by position. Single source of truth: the Edge Function
-- never recomputes it, it takes the value from get_trip_routing_input().
create function public.trip_route_signature(p_trip_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select encode(sha256(convert_to(
           t.travel_mode || E'\n' || coalesce((
             select string_agg(round(s.lat::numeric, 6)::text || ',' || round(s.lng::numeric, 6)::text,
                               ';' order by s.position)
             from public.stops s where s.trip_id = t.id), ''),
           'UTF8')), 'hex')
  from public.trips t where t.id = p_trip_id
$$;

-- ---------- read path for viewers ----------
-- 0 rows => never computed / trip not visible. Otherwise ONE row. The staleness
-- guarantee is enforced HERE, server-side: if the stops (coords, order) or the
-- mode changed since computing, route_status/reason/geometry come back NULL, so
-- a stale line can never be drawn and no client-side comparison is needed.
-- travel_mode is the trip's CURRENT mode.
create function public.get_trip_route(p_trip_id uuid)
returns table (
  trip_id uuid, travel_mode text, route_status text, reason text, polyline text,
  distance_m int, duration_s int, computed_at timestamptz, is_fresh boolean
)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.travel_mode,
         case when f.ok then r.status end,
         case when f.ok then r.reason end,
         case when f.ok then r.polyline end,
         case when f.ok then r.distance_m end,
         case when f.ok then r.duration_s end,
         r.computed_at, f.ok
  from public.trip_routes r
  join public.trips t on t.id = r.trip_id
  cross join lateral (select r.stops_hash = public.trip_route_signature(t.id) as ok) f
  where r.trip_id = p_trip_id
$$;

-- ---------- read path for the Edge Function (owner only, ONE snapshot) ----------
-- Returns [lng,lat] pairs in ORS order, plus the signature of exactly those coords.
-- 0 rows => trip does not exist or caller is not the owner (indistinguishable).
create function public.get_trip_routing_input(p_trip_id uuid)
returns table (travel_mode text, stops_hash text, stop_count int, coords jsonb)
language sql stable security invoker set search_path = '' as $$
  select t.travel_mode,
         public.trip_route_signature(t.id),
         (select count(*)::int from public.stops s where s.trip_id = t.id),
         coalesce((select jsonb_agg(jsonb_build_array(s.lng, s.lat) order by s.position)
                   from public.stops s where s.trip_id = t.id), '[]'::jsonb)
  from public.trips t
  where t.id = p_trip_id and t.owner_id = (select auth.uid())
$$;

-- ---------- rate limit (called BEFORE contacting ORS) ----------
-- SECURITY DEFINER only because the global ORS quota needs to count every user's
-- rows. It trusts nothing from the caller except p_trip_id, which it verifies is
-- owned by auth.uid(); it only ever inserts a row for auth.uid().
-- Limits (tune here, one place):
--   per user : 5 per 10 minutes, 30 per rolling 24 h
--   global   : 1800 per rolling 24 h  (ORS free tier = 2000/day, 10 % headroom)
-- Errors (SQLSTATE P0001, message is the machine code):
--   RATE_LIMITED_USER, RATE_LIMITED_GLOBAL ; 42501 when not owner.
create function public.claim_route_request(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  perform 1 from public.trips t where t.id = p_trip_id and t.owner_id = v_uid;
  if not found then raise exception 'trip not found or not owner' using errcode = '42501'; end if;

  -- serialise concurrent claims of ONE user so parallel requests cannot all pass
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 4));

  if (select count(*) from public.route_requests q
        where q.user_id = v_uid and q.requested_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.route_requests q
        where q.user_id = v_uid and q.requested_at > now() - interval '24 hours') >= 30 then
    raise exception 'RATE_LIMITED_USER' using errcode = 'P0001';
  end if;

  -- global quota (small race across different users is accepted: headroom covers it)
  if (select count(*) from public.route_requests q
        where q.requested_at > now() - interval '24 hours') >= 1800 then
    raise exception 'RATE_LIMITED_GLOBAL' using errcode = 'P0001';
  end if;

  insert into public.route_requests (user_id, trip_id) values (v_uid, p_trip_id);
end $$;

-- ---------- write path (race-safe) ----------
-- Locks the trip row (also serialises against save_trip_stops), re-derives the
-- current signature and stores the outcome ONLY if it still matches the input it
-- was computed from. Returns false (nothing stored) when the trip changed while
-- ORS was working. mode and stop_count come from the DB, never from the caller.
-- Shape rules (ok needs polyline etc.) are enforced by trip_routes_shape_chk.
create function public.save_trip_route(
  p_trip_id uuid, p_status text, p_reason text, p_polyline text,
  p_distance_m double precision, p_duration_s double precision, p_stops_hash text
)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_mode  text;
  v_count int;
begin
  select t.travel_mode into v_mode from public.trips t
    where t.id = p_trip_id and t.owner_id = (select auth.uid()) for update;
  if not found then raise exception 'trip not found or not owner' using errcode = '42501'; end if;

  if p_stops_hash is distinct from public.trip_route_signature(p_trip_id) then
    return false;
  end if;

  select count(*)::int into v_count from public.stops s where s.trip_id = p_trip_id;
  if v_count < 2 then raise exception 'need at least 2 stops' using errcode = '22023'; end if;

  insert into public.trip_routes
    (trip_id, status, reason, travel_mode, polyline, distance_m, duration_s,
     stop_count, stops_hash, computed_at)
  values
    (p_trip_id, p_status, p_reason, v_mode, p_polyline,
     round(p_distance_m)::int, round(p_duration_s)::int, v_count, p_stops_hash, now())
  on conflict (trip_id) do update set
    status = excluded.status, reason = excluded.reason, travel_mode = excluded.travel_mode,
    polyline = excluded.polyline, distance_m = excluded.distance_m,
    duration_s = excluded.duration_s, stop_count = excluded.stop_count,
    stops_hash = excluded.stops_hash, computed_at = excluded.computed_at;
  return true;
end $$;

-- ---------- privileges (login wall, same pattern as 0002) ----------
revoke all on function public.trip_route_signature(uuid)    from public, anon;
revoke all on function public.get_trip_route(uuid)          from public, anon;
revoke all on function public.get_trip_routing_input(uuid)  from public, anon;
revoke all on function public.claim_route_request(uuid)     from public, anon;
revoke all on function public.save_trip_route(uuid, text, text, text, double precision, double precision, text) from public, anon;

grant execute on function public.trip_route_signature(uuid)    to authenticated;
grant execute on function public.get_trip_route(uuid)          to authenticated;
grant execute on function public.get_trip_routing_input(uuid)  to authenticated;
grant execute on function public.claim_route_request(uuid)     to authenticated;
grant execute on function public.save_trip_route(uuid, text, text, text, double precision, double precision, text) to authenticated;

commit;
