-- =============================================================================
-- 0001_init.down.sql : DEV-ONLY rollback of 0001_init.sql
-- Drops all tables (DATA IS LOST), triggers, functions and policies.
-- Keeps the storage buckets and any uploaded files. Never run in production.
-- Run in the Supabase SQL Editor.
-- =============================================================================

begin;

-- storage policies
drop policy if exists avatars_insert      on storage.objects;
drop policy if exists avatars_update      on storage.objects;
drop policy if exists avatars_delete      on storage.objects;
drop policy if exists trip_photos_select  on storage.objects;
drop policy if exists trip_photos_insert  on storage.objects;
drop policy if exists trip_photos_update  on storage.objects;
drop policy if exists trip_photos_delete  on storage.objects;

-- auth trigger (lives on auth.users, not dropped with the public tables)
drop trigger if exists on_auth_user_created on auth.users;

-- tables (also drops their triggers, indexes and policies)
drop table if exists public.stop_photos;
drop table if exists public.stops;
drop table if exists public.trips;
drop table if exists public.profiles;

-- functions
drop function if exists public.get_feed(timestamptz, uuid, int);
drop function if exists public.reorder_stop_photos(uuid, uuid[]);
drop function if exists public.reorder_stops(uuid, uuid[]);
drop function if exists public.stop_photos_set_position();
drop function if exists public.stops_set_position();
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();

-- restore Supabase's default privileges for anon on future objects
alter default privileges in schema public grant all on tables    to anon;
alter default privileges in schema public grant all on sequences to anon;
alter default privileges in schema public grant all on functions to anon;

commit;
