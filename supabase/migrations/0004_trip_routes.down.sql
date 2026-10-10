-- DEV ONLY rollback of 0004_trip_routes.sql.
-- Drops the stored routes (derived, re-computable data), the throttle log and
-- travel_mode (the creator's choice is lost: export it first if it matters).
begin;
drop function if exists public.save_trip_route(uuid, text, text, text, double precision, double precision, text);
drop function if exists public.claim_route_request(uuid);
drop function if exists public.get_trip_routing_input(uuid);
drop function if exists public.get_trip_route(uuid);
drop function if exists public.trip_route_signature(uuid);
drop table if exists public.route_requests;
drop table if exists public.trip_routes;
alter table public.trips drop column if exists travel_mode;
commit;
