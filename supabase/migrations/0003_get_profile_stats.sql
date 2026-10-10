-- =============================================================================
-- 0003_get_profile_stats.sql : trip / stop / photo counts for a profile screen
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
--   Run it ONCE (not idempotent: a second run fails on "already exists" and the
--   transaction rolls back). Requires 0001_init.sql (0002 is not required).
--   Afterwards regenerate types:  npm run gen:types
--   Dev-only rollback: 0003_get_profile_stats.down.sql
--
-- get_profile_stats(p_user_id) returns exactly ONE row (trip_count, stop_count,
-- photo_count) for the trips owned by p_user_id.
--   * SECURITY INVOKER: RLS decides what is counted. The owner sees all own
--     trips (public + private); any other signed-in user only sees public trips,
--     and stops/photos of those. No visibility filter is repeated here on
--     purpose, so the rules can never drift from the policies of 0001.
--   * Unknown / null user id, or a user without trips -> one row of zeros
--     (an aggregate without GROUP BY always yields a row; no 404 handling needed).
--   * int (not bigint), same as get_feed.stop_count: caps are 20 stops/trip and
--     5 photos/stop, so counts stay far below 2^31. Both map to `number` in TS.
--   * One statement. Index use: trips_owner_idx (owner_id, ...) for trips,
--     stops_trip_position_uq (leading trip_id) for stops, and
--     stop_photos_stop_position_uq (leading stop_id) for photos.
--   * Counts use separate subqueries instead of chained joins, so photos never
--     multiply stop rows and no COUNT(DISTINCT) is needed.
-- =============================================================================

begin;

create function public.get_profile_stats(p_user_id uuid)
returns table (trip_count int, stop_count int, photo_count int)
language sql stable security invoker set search_path = '' as $$
  with t as (
    select id from public.trips where owner_id = p_user_id
  ),
  s as (
    select st.id from public.stops st join t on t.id = st.trip_id
  )
  select
    (select count(*)::int from t),
    (select count(*)::int from s),
    (select count(*)::int from public.stop_photos sp join s on s.id = sp.stop_id)
$$;

-- Functions are executable by PUBLIC by default; lock down to signed-in users.
revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;

commit;
