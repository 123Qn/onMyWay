-- DEV ONLY rollback of 0002_save_trip_stops.sql. Drops a function only; no data is touched.
begin;
drop function if exists public.save_trip_stops(uuid, jsonb);
commit;
