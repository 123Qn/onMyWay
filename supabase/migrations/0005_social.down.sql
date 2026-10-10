-- DEV ONLY rollback of 0005_social.sql.
-- User-generated data is NOT deleted: the five data tables are MOVED to schema
-- `archive` (not exposed by the API, no grants), together with their indexes and
-- constraints. The derived counter table is dropped (recomputable from the rows).
-- Re-applying 0005 later works; to bring the data back, INSERT ... SELECT from
-- archive.* into the new tables (comments: parents before replies). If archive.*
-- already exists from an earlier rollback, this script fails: move/drop it by hand.
begin;

-- triggers first (they reference the functions below)
drop trigger if exists trip_likes_throttle    on public.trip_likes;
drop trigger if exists trip_likes_count       on public.trip_likes;
drop trigger if exists comment_likes_throttle on public.comment_likes;
drop trigger if exists comment_likes_count    on public.comment_likes;
drop trigger if exists trip_saves_throttle    on public.trip_saves;
drop trigger if exists trip_comments_throttle on public.trip_comments;
drop trigger if exists trip_comments_guard    on public.trip_comments;
drop trigger if exists trip_comments_count    on public.trip_comments;
drop trigger if exists reposts_throttle       on public.reposts;
drop trigger if exists reposts_count          on public.reposts;
drop trigger if exists trips_create_counts    on public.trips;

-- functions
drop function if exists public.delete_repost(uuid);
drop function if exists public.create_repost(uuid, text);
drop function if exists public.delete_comment(uuid);
drop function if exists public.create_comment(uuid, uuid, text);
drop function if exists public.set_comment_like(uuid, boolean);
drop function if exists public.set_trip_save(uuid, boolean);
drop function if exists public.set_trip_like(uuid, boolean);
drop function if exists public.get_trip_likers(uuid, timestamptz, uuid, int);
drop function if exists public.get_saved_trips(timestamptz, uuid, int);
drop function if exists public.get_replies(uuid, timestamptz, uuid, int);
drop function if exists public.get_comments(uuid, timestamptz, uuid, int);
drop function if exists public.get_trip_social(uuid);
drop function if exists public.get_feed(timestamptz, uuid, int);
drop function if exists public.trg_trip_comments_count();
drop function if exists public.trg_comment_likes_count();
drop function if exists public.trg_reposts_count();
drop function if exists public.trg_trip_likes_count();
drop function if exists public.trg_trips_create_counts();
drop function if exists public.trip_comments_before_insert();
drop function if exists public.social_throttle();

-- derived counters: recomputable, safe to drop
drop table if exists public.trip_social_counts;

-- user data: archive, never delete
create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;
alter table public.reposts       set schema archive;
alter table public.trip_saves    set schema archive;
alter table public.comment_likes set schema archive;
alter table public.trip_comments set schema archive;
alter table public.trip_likes    set schema archive;

-- restore the 0001 feed
create function public.get_feed(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20
)
returns table (
  trip_id uuid, title text, description text, cover_path text, created_at timestamptz,
  owner_id uuid, username text, display_name text, avatar_path text, stop_count int
)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.title, t.description, t.cover_path, t.created_at,
         p.id, p.username, p.display_name, p.avatar_path,
         (select count(*)::int from public.stops s where s.trip_id = t.id)
  from public.trips t
  join public.profiles p on p.id = t.owner_id
  where t.visibility = 'public'
    and (p_before_created_at is null or (t.created_at, t.id) < (p_before_created_at, p_before_id))
  order by t.created_at desc, t.id desc
  limit least(greatest(p_limit, 1), 50)
$$;
revoke all on function public.get_feed(timestamptz, uuid, int) from public, anon;
grant execute on function public.get_feed(timestamptz, uuid, int) to authenticated;

commit;
