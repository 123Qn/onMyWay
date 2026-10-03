-- =============================================================================
-- 0001_init.sql : MVP schema (profiles, trips, stops, stop_photos, storage, feed)
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
--   Run it ONCE on a fresh project. It is NOT idempotent: a second run fails on
--   "already exists" and the surrounding transaction rolls everything back.
--   Dev-only rollback: 0001_init.down.sql (never run it in production).
--
-- Access model: login wall. The `anon` role has no access to anything in the
-- public schema; every policy and RPC is for `authenticated` only.
-- =============================================================================

begin;

-- ---------- helper trigger functions ----------
create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- tables ----------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  avatar_path  text,
  bio          text check (char_length(bio) <= 160),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 5000),
  cover_path  text,
  visibility  text not null default 'private' check (visibility in ('public','private')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.stops (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  position   integer not null check (position >= 0),
  name       text not null check (char_length(name) between 1 and 120),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  address    text,
  notes      text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stops_trip_position_uq unique (trip_id, position) deferrable initially deferred
);

create table public.stop_photos (
  id           uuid primary key default gen_random_uuid(),
  stop_id      uuid not null references public.stops(id) on delete cascade,
  position     integer not null check (position >= 0),
  storage_path text not null,
  created_at   timestamptz not null default now(),
  constraint stop_photos_stop_position_uq unique (stop_id, position) deferrable initially deferred
);

-- ---------- indexes ----------
create index trips_feed_idx  on public.trips (created_at desc, id desc) where visibility = 'public';
create index trips_owner_idx on public.trips (owner_id, created_at desc);

-- ---------- updated_at triggers ----------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();
create trigger stops_updated_at before update on public.stops
  for each row execute function public.set_updated_at();

-- ---------- auto-create profile ----------
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(nullif(left(new.raw_user_meta_data ->> 'display_name', 50), ''), 'Traveller')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- limits + append position (serialised per parent) ----------
-- Max 20 stops per trip, 5 photos per stop, checked on EVERY insert (even when
-- the client supplies a position). The parent row is always locked first so
-- concurrent inserts cannot both pass the count check. Multi-row inserts work:
-- each row's BEFORE trigger (volatile function) sees rows inserted earlier in
-- the same statement.
create function public.stops_set_position()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_count integer;
begin
  perform 1 from public.trips t where t.id = new.trip_id for update;

  select count(*) into v_count from public.stops s where s.trip_id = new.trip_id;
  if v_count >= 20 then
    raise exception 'stop limit reached' using errcode = 'P0001';
  end if;

  if new.position is null then
    select coalesce(max(s.position), -1) + 1 into new.position
      from public.stops s where s.trip_id = new.trip_id;
  end if;
  return new;
end $$;
create trigger stops_before_insert before insert on public.stops
  for each row execute function public.stops_set_position();

create function public.stop_photos_set_position()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_count integer;
begin
  perform 1 from public.stops s where s.id = new.stop_id for update;

  select count(*) into v_count from public.stop_photos p where p.stop_id = new.stop_id;
  if v_count >= 5 then
    raise exception 'photo limit reached' using errcode = 'P0001';
  end if;

  if new.position is null then
    select coalesce(max(p.position), -1) + 1 into new.position
      from public.stop_photos p where p.stop_id = new.stop_id;
  end if;
  return new;
end $$;
create trigger stop_photos_before_insert before insert on public.stop_photos
  for each row execute function public.stop_photos_set_position();

-- ---------- reorder RPCs (security invoker: RLS applies) ----------
create function public.reorder_stops(p_trip_id uuid, p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare n int := coalesce(array_length(p_ids, 1), 0);
begin
  perform 1 from public.trips t
    where t.id = p_trip_id and t.owner_id = (select auth.uid()) for update;
  if not found then raise exception 'trip not found or not owner' using errcode = '42501'; end if;

  if (select count(distinct x) from unnest(p_ids) x) <> n
     or (select count(*) from public.stops s where s.trip_id = p_trip_id) <> n
     or (select count(*) from public.stops s where s.trip_id = p_trip_id and s.id = any(p_ids)) <> n then
    raise exception 'ids must be exactly the stops of this trip' using errcode = '22023';
  end if;

  update public.stops s set position = u.ord - 1
    from unnest(p_ids) with ordinality as u(id, ord)
    where s.id = u.id and s.trip_id = p_trip_id;
end $$;

create function public.reorder_stop_photos(p_stop_id uuid, p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare n int := coalesce(array_length(p_ids, 1), 0);
begin
  perform 1 from public.stops s join public.trips t on t.id = s.trip_id
    where s.id = p_stop_id and t.owner_id = (select auth.uid()) for update of s;
  if not found then raise exception 'stop not found or not owner' using errcode = '42501'; end if;

  if (select count(distinct x) from unnest(p_ids) x) <> n
     or (select count(*) from public.stop_photos sp where sp.stop_id = p_stop_id) <> n
     or (select count(*) from public.stop_photos sp where sp.stop_id = p_stop_id and sp.id = any(p_ids)) <> n then
    raise exception 'ids must be exactly the photos of this stop' using errcode = '22023';
  end if;

  update public.stop_photos p set position = u.ord - 1
    from unnest(p_ids) with ordinality as u(id, ord)
    where p.id = u.id and p.stop_id = p_stop_id;
end $$;

-- ---------- feed ----------
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

-- ---------- RLS ----------
alter table public.profiles    enable row level security;
alter table public.trips       enable row level security;
alter table public.stops       enable row level security;
alter table public.stop_photos enable row level security;

-- ---------- privileges (login wall) ----------
-- Placed after all tables/functions exist. Supabase default privileges grant
-- anon/authenticated access explicitly, and functions are executable by PUBLIC
-- by default, so revoke from PUBLIC as well, then grant back only what the
-- signed-in app needs. Trigger functions do not need EXECUTE to fire.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke execute on all functions in schema public from public, authenticated;

grant execute on function public.reorder_stops(uuid, uuid[])       to authenticated;
grant execute on function public.reorder_stop_photos(uuid, uuid[]) to authenticated;
grant execute on function public.get_feed(timestamptz, uuid, int)  to authenticated;

-- Future objects created by this role in public must not be reachable by anon.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------- policies ----------
-- profiles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- trips
create policy trips_select on public.trips for select to authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()));
create policy trips_insert on public.trips for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy trips_update on public.trips for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy trips_delete on public.trips for delete to authenticated
  using (owner_id = (select auth.uid()));

-- stops (visibility inherited through trips RLS)
create policy stops_select on public.stops for select to authenticated
  using (exists (select 1 from public.trips t where t.id = stops.trip_id));
create policy stops_insert on public.stops for insert to authenticated
  with check (exists (select 1 from public.trips t
                      where t.id = stops.trip_id and t.owner_id = (select auth.uid())));
create policy stops_update on public.stops for update to authenticated
  using (exists (select 1 from public.trips t
                 where t.id = stops.trip_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t
                      where t.id = stops.trip_id and t.owner_id = (select auth.uid())));
create policy stops_delete on public.stops for delete to authenticated
  using (exists (select 1 from public.trips t
                 where t.id = stops.trip_id and t.owner_id = (select auth.uid())));

-- stop_photos
create policy stop_photos_select on public.stop_photos for select to authenticated
  using (exists (select 1 from public.stops s where s.id = stop_photos.stop_id));
create policy stop_photos_insert on public.stop_photos for insert to authenticated
  with check (exists (select 1 from public.stops s join public.trips t on t.id = s.trip_id
                      where s.id = stop_photos.stop_id and t.owner_id = (select auth.uid())));
create policy stop_photos_update on public.stop_photos for update to authenticated
  using (exists (select 1 from public.stops s join public.trips t on t.id = s.trip_id
                 where s.id = stop_photos.stop_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.stops s join public.trips t on t.id = s.trip_id
                      where s.id = stop_photos.stop_id and t.owner_id = (select auth.uid())));
create policy stop_photos_delete on public.stop_photos for delete to authenticated
  using (exists (select 1 from public.stops s join public.trips t on t.id = s.trip_id
                 where s.id = stop_photos.stop_id and t.owner_id = (select auth.uid())));

-- ---------- storage ----------
-- Only inserts buckets and creates policies; RLS on storage.objects is already
-- enabled by Supabase (no ALTER TABLE needed, so no superuser required).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',     'avatars',     true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('trip-photos', 'trip-photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- avatars: path {user_id}/{uuid}.{ext}
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- trip-photos: path {user_id}/{trip_id}/{file}  (covers use the same path)
-- Read: own files, or files of a public trip whose owner matches folder 1.
create policy trip_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.trips t
                 where t.id::text = (storage.foldername(name))[2]
                   and t.owner_id::text = (storage.foldername(name))[1]
                   and t.visibility = 'public')
    )
  );
-- Write: own folder AND folder 2 must be a trip owned by the caller
-- (the trip row is inserted first, as private, before uploading).
create policy trip_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.trips t
                where t.id::text = (storage.foldername(name))[2]
                  and t.owner_id = (select auth.uid()))
  );
create policy trip_photos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.trips t
                where t.id::text = (storage.foldername(name))[2]
                  and t.owner_id = (select auth.uid()))
  );
-- Delete stays folder-1 only so files can still be cleaned up after a trip row is gone.
create policy trip_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'trip-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
