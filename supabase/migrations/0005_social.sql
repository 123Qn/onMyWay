-- =============================================================================
-- 0005_social.sql : likes, comments (1 reply level), comment likes, saves, reposts
--
-- HOW TO APPLY
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
--   Run it ONCE (not idempotent). Requires 0001..0004 applied first.
--   Afterwards regenerate types:  npm run gen:types
--   Dev-only rollback: 0005_social.down.sql (archives the user data, see there)
--   Design, decisions and coder checklist: docs/SOCIAL-DB.md
--
-- Adds
--   trip_social_counts   denormalised like/comment/repost counts per trip (trigger-kept)
--   trip_likes           public likes on trips
--   trip_comments        comments + ONE level of replies (deleting a parent deletes its replies)
--   comment_likes        likes on comments
--   trip_saves           PRIVATE bookmarks (only the saver can read)
--   reposts              in-app share to the global feed, optional caption
--   get_feed (REPLACED)  same name + args, richer rows (originals + reposts)
--   get_trip_social, get_comments, get_replies, get_saved_trips, get_trip_likers
--   set_trip_like, set_trip_save, set_comment_like, create_comment, delete_comment,
--   create_repost, delete_repost   idempotent mutation RPCs returning canonical counts
--
-- Access model (as 0001): login wall, `anon` gets nothing. Read visibility is
-- ALWAYS derived from the trips policy (public trip, or own trip), so a trip that
-- turns private hides its likes, comments and reposts from everybody but the owner.
-- Nothing is deleted when that happens: it reappears if the trip is public again.
-- Private trips accept NO new social writes (like, comment, save, repost).
-- Error contract: docs/SOCIAL-DB.md section 7 (RATE_LIMITED has SQLSTATE RL429).
-- =============================================================================

begin;

-- ---------- counters (separate table, see docs/SOCIAL-DB.md section 3) ----------
create table public.trip_social_counts (
  trip_id       uuid primary key references public.trips(id) on delete cascade,
  like_count    integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0), -- live comments + replies
  repost_count  integer not null default 0 check (repost_count >= 0)
);

insert into public.trip_social_counts (trip_id) select id from public.trips;

create function public.trg_trips_create_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.trip_social_counts (trip_id) values (new.id);
  return null;
end $$;
create trigger trips_create_counts after insert on public.trips
  for each row execute function public.trg_trips_create_counts();

-- ---------- trip_likes ----------
create table public.trip_likes (
  trip_id    uuid not null references public.trips(id)    on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)                       -- no double likes
);
create index trip_likes_trip_time_idx on public.trip_likes (trip_id, created_at desc, user_id desc); -- likers list
create index trip_likes_user_time_idx on public.trip_likes (user_id, created_at desc);               -- throttle

-- ---------- trip_comments ----------
create table public.trip_comments (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id)    on delete cascade,
  parent_id   uuid,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500 and btrim(body) <> ''),
  like_count  integer not null default 0 check (like_count >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  created_at  timestamptz not null default now(),
  constraint trip_comments_id_trip_uq unique (id, trip_id),
  -- a reply lives on the SAME trip as its parent (parent_id null = top level);
  -- deleting a parent deletes its replies
  constraint trip_comments_parent_fk foreign key (parent_id, trip_id)
    references public.trip_comments (id, trip_id) on delete cascade,
  -- replies have no replies of their own
  constraint trip_comments_reply_chk check (parent_id is null or reply_count = 0)
);
create index trip_comments_trip_idx      on public.trip_comments (trip_id);                         -- FK cascade
create index trip_comments_top_idx       on public.trip_comments (trip_id, created_at desc, id desc) where parent_id is null;
create index trip_comments_replies_idx   on public.trip_comments (parent_id, created_at, id)          where parent_id is not null;
create index trip_comments_user_time_idx on public.trip_comments (user_id, created_at desc);        -- throttle

-- ---------- comment_likes ----------
create table public.comment_likes (
  comment_id uuid not null references public.trip_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id)      on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user_time_idx on public.comment_likes (user_id, created_at desc);

-- ---------- trip_saves (private) ----------
create table public.trip_saves (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  trip_id    uuid not null references public.trips(id)    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
create index trip_saves_user_time_idx on public.trip_saves (user_id, created_at desc, trip_id desc); -- saved list + throttle
create index trip_saves_trip_idx      on public.trip_saves (trip_id);                                -- FK cascade

-- ---------- reposts ----------
create table public.reposts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  trip_id    uuid not null references public.trips(id)    on delete cascade,
  caption    text check (caption is null or (char_length(caption) between 1 and 280 and btrim(caption) <> '')),
  created_at timestamptz not null default now(),
  constraint reposts_user_trip_uq unique (user_id, trip_id)   -- one repost per user per trip
);
create index reposts_feed_idx      on public.reposts (created_at desc, id desc);   -- global feed branch
create index reposts_user_time_idx on public.reposts (user_id, created_at desc, id desc);
create index reposts_trip_idx      on public.reposts (trip_id);                    -- FK cascade

-- =============================================================================
-- Trigger functions. All SECURITY DEFINER with search_path = '' because they
-- touch tables the caller has no write privilege on (counters, comment rows).
-- They only ever act on the row being written. No EXECUTE grant needed to fire.
-- =============================================================================

-- ---------- per-user throttle: args = (max per minute, max per hour) ----------
-- Counts the caller's existing rows in the trigger's own table. Serialised per
-- (user, table) by an advisory lock so parallel inserts cannot all pass.
-- Un-like / un-save churn is not counted (rows are gone); see docs section 5.
create function public.social_throttle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_min  int := tg_argv[0]::int;
  v_hour int := tg_argv[1]::int;
  n      int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || tg_table_name, 5));

  execute format('select count(*) from %I.%I where user_id = $1 and created_at > now() - interval ''1 minute''',
                 tg_table_schema, tg_table_name) into n using new.user_id;
  if n >= v_min then
    raise exception 'RATE_LIMITED' using errcode = 'RL429', detail = tg_table_name;
  end if;

  execute format('select count(*) from %I.%I where user_id = $1 and created_at > now() - interval ''1 hour''',
                 tg_table_schema, tg_table_name) into n using new.user_id;
  if n >= v_hour then
    raise exception 'RATE_LIMITED' using errcode = 'RL429', detail = tg_table_name;
  end if;
  return new;
end $$;

create trigger trip_likes_throttle    before insert on public.trip_likes
  for each row execute function public.social_throttle(60, 600);
create trigger comment_likes_throttle before insert on public.comment_likes
  for each row execute function public.social_throttle(60, 600);
create trigger trip_saves_throttle    before insert on public.trip_saves
  for each row execute function public.social_throttle(60, 600);
create trigger trip_comments_throttle before insert on public.trip_comments
  for each row execute function public.social_throttle(10, 120);
create trigger reposts_throttle       before insert on public.reposts
  for each row execute function public.social_throttle(10, 30);

-- ---------- comment insert guard: one reply level ----------
-- The composite FK already guarantees parent.trip_id = new.trip_id. A reply to a
-- reply is RE-PARENTED to the top-level comment (the UI prefixes "@username").
-- The parent row is locked FOR UPDATE: it serialises concurrent replies (they all
-- update parent.reply_count anyway; locking first avoids share->update deadlocks)
-- and a concurrent delete of the parent (the reply then fails: parent not found).
create function public.trip_comments_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parent public.trip_comments;
begin
  if new.parent_id is not null then
    select * into v_parent from public.trip_comments c where c.id = new.parent_id for update;
    if not found then
      raise exception 'INVALID_PARENT' using errcode = '22023';
    end if;
    if v_parent.parent_id is not null then
      new.parent_id := v_parent.parent_id;      -- attach to the top-level comment
    end if;
  end if;
  return new;
end $$;
create trigger trip_comments_guard before insert on public.trip_comments
  for each row execute function public.trip_comments_before_insert();

-- ---------- counter maintenance ----------
create function public.trg_trip_likes_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.trip_social_counts set like_count = like_count + 1 where trip_id = new.trip_id;
  else
    update public.trip_social_counts set like_count = greatest(like_count - 1, 0) where trip_id = old.trip_id;
  end if;
  return null;
end $$;
create trigger trip_likes_count after insert or delete on public.trip_likes
  for each row execute function public.trg_trip_likes_count();

create function public.trg_reposts_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.trip_social_counts set repost_count = repost_count + 1 where trip_id = new.trip_id;
  else
    update public.trip_social_counts set repost_count = greatest(repost_count - 1, 0) where trip_id = old.trip_id;
  end if;
  return null;
end $$;
create trigger reposts_count after insert or delete on public.reposts
  for each row execute function public.trg_reposts_count();

create function public.trg_comment_likes_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.trip_comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.trip_comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end $$;
create trigger comment_likes_count after insert or delete on public.comment_likes
  for each row execute function public.trg_comment_likes_count();

-- comment_count = ALL comments of the trip (top-level + replies). Deleting a
-- parent cascades to its replies; each cascaded row runs the DELETE branch, so the
-- count drops by the whole subtree. Updates are no-ops (0 rows) when the trip or
-- parent is itself being removed by a cascade, so cascades never fail here.
create function public.trg_trip_comments_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.trip_social_counts set comment_count = comment_count + 1 where trip_id = new.trip_id;
    if new.parent_id is not null then
      update public.trip_comments set reply_count = reply_count + 1 where id = new.parent_id;
    end if;
  else
    update public.trip_social_counts set comment_count = greatest(comment_count - 1, 0) where trip_id = old.trip_id;
    if old.parent_id is not null then
      update public.trip_comments set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
    end if;
  end if;
  return null;
end $$;
create trigger trip_comments_count after insert or delete on public.trip_comments
  for each row execute function public.trg_trip_comments_count();

-- =============================================================================
-- RLS + privileges
-- =============================================================================
alter table public.trip_social_counts enable row level security;
alter table public.trip_likes         enable row level security;
alter table public.trip_comments      enable row level security;
alter table public.comment_likes      enable row level security;
alter table public.trip_saves         enable row level security;
alter table public.reposts            enable row level security;

-- Least privilege: Supabase grants ALL to authenticated on new tables by default.
revoke all on public.trip_social_counts, public.trip_likes, public.trip_comments,
              public.comment_likes, public.trip_saves, public.reposts
  from anon, authenticated;

grant select on public.trip_social_counts to authenticated;                  -- written by triggers only
grant select, delete on public.trip_likes    to authenticated;
grant insert (trip_id, user_id) on public.trip_likes to authenticated;       -- created_at cannot be forged
grant select, delete on public.trip_comments to authenticated;               -- NO update: counts stay trigger-owned
grant insert (trip_id, parent_id, user_id, body) on public.trip_comments to authenticated; -- counts cannot be forged
grant select, delete on public.comment_likes to authenticated;
grant insert (comment_id, user_id) on public.comment_likes to authenticated;
grant select, delete on public.trip_saves    to authenticated;
grant insert (user_id, trip_id) on public.trip_saves to authenticated;
grant select, delete on public.reposts       to authenticated;
grant insert (user_id, trip_id, caption) on public.reposts to authenticated;
grant update (caption) on public.reposts     to authenticated;

-- counts: visible with the trip
create policy trip_social_counts_select on public.trip_social_counts for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_social_counts.trip_id));

-- trip_likes: public among everyone who can see the trip. Writes: own rows, public trips only.
create policy trip_likes_select on public.trip_likes for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_likes.trip_id));
create policy trip_likes_insert on public.trip_likes for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.trips t
                          where t.id = trip_likes.trip_id and t.visibility = 'public'));
create policy trip_likes_delete on public.trip_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- trip_comments: read with the trip. Insert: own, public trip. Delete: author OR trip owner.
create policy trip_comments_select on public.trip_comments for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_comments.trip_id));
create policy trip_comments_insert on public.trip_comments for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.trips t
                          where t.id = trip_comments.trip_id and t.visibility = 'public'));
create policy trip_comments_delete on public.trip_comments for delete to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.trips t
                    where t.id = trip_comments.trip_id and t.owner_id = (select auth.uid())));

-- comment_likes: read with the comment (hence the trip). Insert: comment on a public trip.
create policy comment_likes_select on public.comment_likes for select to authenticated
  using (exists (select 1 from public.trip_comments c where c.id = comment_likes.comment_id));
create policy comment_likes_insert on public.comment_likes for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.trip_comments c
                          join public.trips t on t.id = c.trip_id
                          where c.id = comment_likes.comment_id and t.visibility = 'public'));
create policy comment_likes_delete on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- trip_saves: PRIVATE. Only the saver reads. Saving needs a PUBLIC trip that is not
-- the caller's own. A save of a trip that turns private stays stored but
-- get_saved_trips() no longer returns it. Un-saving is always allowed.
create policy trip_saves_select on public.trip_saves for select to authenticated
  using (user_id = (select auth.uid()));
create policy trip_saves_insert on public.trip_saves for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.trips t
                          where t.id = trip_saves.trip_id and t.visibility = 'public'
                            and t.owner_id <> (select auth.uid())));
create policy trip_saves_delete on public.trip_saves for delete to authenticated
  using (user_id = (select auth.uid()));

-- reposts: read with the trip (a repost of a trip that went private is hidden from
-- everyone except the trip owner, who is never the reposter) - the whole row,
-- caption included, so nothing about the trip leaks. The reposter can always see
-- and remove their own row. Insert: public trip the caller does NOT own.
create policy reposts_select on public.reposts for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.trips t where t.id = reposts.trip_id));
create policy reposts_insert on public.reposts for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.trips t
                          where t.id = reposts.trip_id and t.visibility = 'public'
                            and t.owner_id <> (select auth.uid())));
create policy reposts_update on public.reposts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.trips t
                          where t.id = reposts.trip_id and t.visibility = 'public'));
create policy reposts_delete on public.reposts for delete to authenticated
  using (user_id = (select auth.uid()));

-- =============================================================================
-- RPCs. All SECURITY INVOKER (RLS decides visibility) except delete_comment.
-- Keyset cursors are always the last row's (created_at, id) sent TOGETHER
-- (a row comparison with only one of them is null => empty page).
-- Limit is clamped to 1..50.
-- =============================================================================

-- ---------- feed: originals + reposts, newest first ----------
-- REPLACES the 0001 function (return type changes => drop + create, same args).
-- created_at is the FEED time (trip time for 'trip', repost time for 'repost');
-- the cursor is (created_at, item_id). item_id is unique per row, trip_id is NOT
-- (an original and its reposts share it): key list rows by item_id.
-- Each branch is limited to the page size before the merge, so both use their
-- own index (trips_feed_idx, reposts_feed_idx) and the join work is one page.
drop function public.get_feed(timestamptz, uuid, int);
create function public.get_feed(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20
)
returns table (
  item_id uuid, item_type text, created_at timestamptz,
  trip_id uuid, trip_created_at timestamptz, title text, description text, cover_path text,
  owner_id uuid, username text, display_name text, avatar_path text, stop_count int,
  like_count int, comment_count int, repost_count int,
  liked_by_me boolean, saved_by_me boolean, reposted_by_me boolean,
  repost_caption text, reposter_id uuid,
  reposter_username text, reposter_display_name text, reposter_avatar_path text
)
language sql stable security invoker set search_path = '' as $$
  with page as (
    select u.* from (
      (select 'trip'::text as item_type, t.id as item_id, t.created_at as feed_at,
              t.id as trip_id, null::uuid as reposter_id, null::text as caption
         from public.trips t
        where t.visibility = 'public'
          and (p_before_created_at is null or (t.created_at, t.id) < (p_before_created_at, p_before_id))
        order by t.created_at desc, t.id desc
        limit least(greatest(p_limit, 1), 50))
      union all
      (select 'repost'::text, r.id, r.created_at, r.trip_id, r.user_id, r.caption
         from public.reposts r
         join public.trips t on t.id = r.trip_id
        where t.visibility = 'public'
          and (p_before_created_at is null or (r.created_at, r.id) < (p_before_created_at, p_before_id))
        order by r.created_at desc, r.id desc
        limit least(greatest(p_limit, 1), 50))
    ) u
    order by u.feed_at desc, u.item_id desc
    limit least(greatest(p_limit, 1), 50)
  )
  select pg.item_id, pg.item_type, pg.feed_at,
         t.id, t.created_at, t.title, t.description, t.cover_path,
         o.id, o.username, o.display_name, o.avatar_path,
         (select count(*)::int from public.stops s where s.trip_id = t.id),
         coalesce(c.like_count, 0), coalesce(c.comment_count, 0), coalesce(c.repost_count, 0),
         exists (select 1 from public.trip_likes l where l.trip_id = t.id and l.user_id = (select auth.uid())),
         exists (select 1 from public.trip_saves v where v.trip_id = t.id and v.user_id = (select auth.uid())),
         exists (select 1 from public.reposts q   where q.trip_id = t.id and q.user_id = (select auth.uid())),
         pg.caption, pg.reposter_id, rp.username, rp.display_name, rp.avatar_path
  from page pg
  join public.trips t on t.id = pg.trip_id
  join public.profiles o on o.id = t.owner_id
  left join public.trip_social_counts c on c.trip_id = t.id
  left join public.profiles rp on rp.id = pg.reposter_id
  order by pg.feed_at desc, pg.item_id desc
$$;

-- ---------- one trip: counts + my state (trip detail screen) ----------
-- 0 rows => trip does not exist or is not visible to the caller.
create function public.get_trip_social(p_trip_id uuid)
returns table (
  trip_id uuid, owner_id uuid,
  like_count int, comment_count int, repost_count int,
  liked_by_me boolean, saved_by_me boolean, reposted_by_me boolean,
  can_repost boolean
)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.owner_id,
         coalesce(c.like_count, 0), coalesce(c.comment_count, 0), coalesce(c.repost_count, 0),
         exists (select 1 from public.trip_likes l where l.trip_id = t.id and l.user_id = (select auth.uid())),
         exists (select 1 from public.trip_saves v where v.trip_id = t.id and v.user_id = (select auth.uid())),
         exists (select 1 from public.reposts q   where q.trip_id = t.id and q.user_id = (select auth.uid())),
         (t.visibility = 'public' and t.owner_id <> (select auth.uid()))
  from public.trips t
  left join public.trip_social_counts c on c.trip_id = t.id
  where t.id = p_trip_id
$$;

-- ---------- top-level comments, newest first ----------
-- can_delete = author OR trip owner. reply_count drives "View N replies".
create function public.get_comments(
  p_trip_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20
)
returns table (
  comment_id uuid, parent_id uuid, user_id uuid, username text, display_name text, avatar_path text,
  body text, created_at timestamptz,
  like_count int, reply_count int, liked_by_me boolean, can_delete boolean
)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.parent_id,
         c.user_id, p.username, p.display_name, p.avatar_path,
         c.body, c.created_at,
         c.like_count, c.reply_count,
         exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = (select auth.uid())),
         (c.user_id = (select auth.uid()) or t.owner_id = (select auth.uid()))
  from public.trip_comments c
  join public.trips t on t.id = c.trip_id
  join public.profiles p on p.id = c.user_id
  where c.trip_id = p_trip_id and c.parent_id is null
    and (p_before_created_at is null or (c.created_at, c.id) < (p_before_created_at, p_before_id))
  order by c.created_at desc, c.id desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- ---------- replies of one comment, OLDEST first (conversation order) ----------
-- Cursor moves forward: pass the LAST row's (created_at, comment_id) as p_after_*.
create function public.get_replies(
  p_comment_id uuid,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit int default 20
)
returns table (
  comment_id uuid, parent_id uuid, user_id uuid, username text, display_name text, avatar_path text,
  body text, created_at timestamptz,
  like_count int, reply_count int, liked_by_me boolean, can_delete boolean
)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.parent_id,
         c.user_id, p.username, p.display_name, p.avatar_path,
         c.body, c.created_at,
         c.like_count, c.reply_count,
         exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = (select auth.uid())),
         (c.user_id = (select auth.uid()) or t.owner_id = (select auth.uid()))
  from public.trip_comments c
  join public.trips t on t.id = c.trip_id
  join public.profiles p on p.id = c.user_id
  where c.parent_id = p_comment_id
    and (p_after_created_at is null or (c.created_at, c.id) > (p_after_created_at, p_after_id))
  order by c.created_at asc, c.id asc
  limit least(greatest(p_limit, 1), 50)
$$;

-- ---------- my saved trips, most recently saved first ----------
-- created_at = SAVE time. Cursor = (created_at, trip_id) of the last row.
-- Trips that are no longer visible (turned private by someone else, deleted)
-- silently drop out via trips RLS. The limit applies after that filter, so a page
-- is only short when the list is really exhausted ("rows < limit" is a valid stop).
create function public.get_saved_trips(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20
)
returns table (
  trip_id uuid, created_at timestamptz, trip_created_at timestamptz,
  title text, description text, cover_path text,
  owner_id uuid, username text, display_name text, avatar_path text, stop_count int,
  like_count int, comment_count int, repost_count int, liked_by_me boolean
)
language sql stable security invoker set search_path = '' as $$
  select t.id, v.created_at, t.created_at, t.title, t.description, t.cover_path,
         o.id, o.username, o.display_name, o.avatar_path,
         (select count(*)::int from public.stops s where s.trip_id = t.id),
         coalesce(c.like_count, 0), coalesce(c.comment_count, 0), coalesce(c.repost_count, 0),
         exists (select 1 from public.trip_likes l where l.trip_id = t.id and l.user_id = (select auth.uid()))
  from public.trip_saves v
  join public.trips t on t.id = v.trip_id
  join public.profiles o on o.id = t.owner_id
  left join public.trip_social_counts c on c.trip_id = t.id
  where v.user_id = (select auth.uid()) and t.visibility = 'public'
    and (p_before_created_at is null or (v.created_at, v.trip_id) < (p_before_created_at, p_before_id))
  order by v.created_at desc, v.trip_id desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- ---------- who liked a trip, newest like first ----------
-- Cursor = (created_at, user_id) of the last row. Empty for invisible trips.
create function public.get_trip_likers(
  p_trip_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 30
)
returns table (user_id uuid, created_at timestamptz, username text, display_name text, avatar_path text)
language sql stable security invoker set search_path = '' as $$
  select l.user_id, l.created_at, p.username, p.display_name, p.avatar_path
  from public.trip_likes l
  join public.profiles p on p.id = l.user_id
  where l.trip_id = p_trip_id
    and (p_before_created_at is null or (l.created_at, l.user_id) < (p_before_created_at, p_before_id))
  order by l.created_at desc, l.user_id desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- =============================================================================
-- Mutation RPCs. SECURITY INVOKER: RLS + column grants + throttle triggers apply.
-- Idempotent "set" semantics so the client can retry / reconcile safely.
-- Errors (message = stable code; see docs/SOCIAL-DB.md section 7):
--   42501 'TRIP_UNAVAILABLE'   trip missing, private, or RLS refused the write
--   22023 'OWN_TRIP'           save/repost of your own trip
--   42501 'COMMENT_NOT_FOUND'  unknown / not yours to delete
--   RL429 'RATE_LIMITED'       throttle (from the trigger)
-- =============================================================================

create function public.set_trip_like(p_trip_id uuid, p_liked boolean)
returns table (liked boolean, like_count int)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if p_liked then
    if not exists (select 1 from public.trips t where t.id = p_trip_id and t.visibility = 'public') then
      raise exception 'TRIP_UNAVAILABLE' using errcode = '42501';
    end if;
    if not exists (select 1 from public.trip_likes l where l.trip_id = p_trip_id and l.user_id = v_uid) then
      insert into public.trip_likes (trip_id, user_id) values (p_trip_id, v_uid) on conflict do nothing;
    end if;
  else
    delete from public.trip_likes l where l.trip_id = p_trip_id and l.user_id = v_uid;
  end if;
  return query
    select exists (select 1 from public.trip_likes l where l.trip_id = p_trip_id and l.user_id = v_uid),
           (select coalesce(c.like_count, 0) from public.trip_social_counts c where c.trip_id = p_trip_id);
end $$;

create function public.set_trip_save(p_trip_id uuid, p_saved boolean)
returns table (saved boolean)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid   uuid := (select auth.uid());
  v_owner uuid;
begin
  if p_saved then
    if not exists (select 1 from public.trip_saves v where v.trip_id = p_trip_id and v.user_id = v_uid) then
      select t.owner_id into v_owner from public.trips t where t.id = p_trip_id and t.visibility = 'public';
      if not found then raise exception 'TRIP_UNAVAILABLE' using errcode = '42501'; end if;
      if v_owner = v_uid then raise exception 'OWN_TRIP' using errcode = '22023'; end if;
      insert into public.trip_saves (user_id, trip_id) values (v_uid, p_trip_id) on conflict do nothing;
    end if;
  else
    delete from public.trip_saves v where v.trip_id = p_trip_id and v.user_id = v_uid;
  end if;
  return query select exists (select 1 from public.trip_saves v where v.trip_id = p_trip_id and v.user_id = v_uid);
end $$;

create function public.set_comment_like(p_comment_id uuid, p_liked boolean)
returns table (liked boolean, like_count int)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if p_liked then
    if not exists (select 1 from public.trip_comments c join public.trips t on t.id = c.trip_id
                    where c.id = p_comment_id and t.visibility = 'public') then
      raise exception 'COMMENT_NOT_FOUND' using errcode = '42501';
    end if;
    if not exists (select 1 from public.comment_likes l where l.comment_id = p_comment_id and l.user_id = v_uid) then
      insert into public.comment_likes (comment_id, user_id) values (p_comment_id, v_uid) on conflict do nothing;
    end if;
  else
    delete from public.comment_likes l where l.comment_id = p_comment_id and l.user_id = v_uid;
  end if;
  return query
    select exists (select 1 from public.comment_likes l where l.comment_id = p_comment_id and l.user_id = v_uid),
           (select c.like_count from public.trip_comments c where c.id = p_comment_id);
end $$;

-- Creates a comment (p_parent_id null) or a reply. A reply to a reply is attached
-- to the top-level parent by the trigger (the returned parent_id is the real one).
-- Body is trimmed here; 1..500 chars after trim, else 22023 'BAD_BODY'.
-- Returns the new row ready for the list plus the trip's new comment_count.
create function public.create_comment(p_trip_id uuid, p_parent_id uuid, p_body text)
returns table (
  comment_id uuid, parent_id uuid, user_id uuid, username text, display_name text, avatar_path text,
  body text, created_at timestamptz, like_count int, reply_count int,
  liked_by_me boolean, can_delete boolean, comment_count int
)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid  uuid := (select auth.uid());
  v_body text := btrim(p_body);
  v_id   uuid;
begin
  if v_body is null or char_length(v_body) not between 1 and 500 then
    raise exception 'BAD_BODY' using errcode = '22023';
  end if;
  if not exists (select 1 from public.trips t where t.id = p_trip_id and t.visibility = 'public') then
    raise exception 'TRIP_UNAVAILABLE' using errcode = '42501';
  end if;

  insert into public.trip_comments (trip_id, parent_id, user_id, body)
  values (p_trip_id, p_parent_id, v_uid, v_body)
  returning id into v_id;

  return query
    select c.id, c.parent_id, c.user_id, p.username, p.display_name, p.avatar_path,
           c.body, c.created_at, c.like_count, c.reply_count, false, true,
           (select n.comment_count from public.trip_social_counts n where n.trip_id = c.trip_id)
    from public.trip_comments c
    join public.profiles p on p.id = c.user_id
    where c.id = v_id;
end $$;

-- Deletes a comment AND its replies (author, or owner of the trip; RLS decides).
-- Returns the trip's new comment_count (whole subtree already subtracted).
-- Unknown / not allowed => 42501 COMMENT_NOT_FOUND (same error, no existence oracle).
create function public.delete_comment(p_comment_id uuid)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
begin
  delete from public.trip_comments c where c.id = p_comment_id returning c.trip_id into v_trip;
  if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = '42501'; end if;
  return (select n.comment_count from public.trip_social_counts n where n.trip_id = v_trip);
end $$;

-- Repost the ORIGINAL trip (the app passes the original's id, also from a repost
-- card). Idempotent: an existing repost is returned unchanged (caption NOT
-- overwritten; edit through the reposts_update policy). Caption trimmed, empty =>
-- null, max 280 else 22023 'BAD_CAPTION'.
create function public.create_repost(p_trip_id uuid, p_caption text default null)
returns table (repost_id uuid, repost_count int)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid     uuid := (select auth.uid());
  v_owner   uuid;
  v_caption text := nullif(btrim(coalesce(p_caption, '')), '');
  v_id      uuid;
begin
  if v_caption is not null and char_length(v_caption) > 280 then
    raise exception 'BAD_CAPTION' using errcode = '22023';
  end if;
  select t.owner_id into v_owner from public.trips t where t.id = p_trip_id and t.visibility = 'public';
  if not found then raise exception 'TRIP_UNAVAILABLE' using errcode = '42501'; end if;
  if v_owner = v_uid then raise exception 'OWN_TRIP' using errcode = '22023'; end if;

  select r.id into v_id from public.reposts r where r.user_id = v_uid and r.trip_id = p_trip_id;
  if v_id is null then
    insert into public.reposts (user_id, trip_id, caption) values (v_uid, p_trip_id, v_caption)
      on conflict (user_id, trip_id) do nothing
      returning id into v_id;
    if v_id is null then  -- concurrent duplicate from the same user: read the winner
      select r.id into v_id from public.reposts r where r.user_id = v_uid and r.trip_id = p_trip_id;
    end if;
  end if;
  return query select v_id, (select n.repost_count from public.trip_social_counts n where n.trip_id = p_trip_id);
end $$;

-- Removes MY repost. Idempotent: unknown / already gone => 0 rows.
create function public.delete_repost(p_repost_id uuid)
returns table (trip_id uuid, repost_count int)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_trip uuid;
begin
  delete from public.reposts r
    where r.id = p_repost_id and r.user_id = (select auth.uid())
    returning r.trip_id into v_trip;
  if not found then return; end if;
  return query select v_trip, (select n.repost_count from public.trip_social_counts n where n.trip_id = v_trip);
end $$;

-- ---------- privileges on functions (login wall) ----------
revoke all on function public.social_throttle()              from public, anon, authenticated;
revoke all on function public.trip_comments_before_insert()  from public, anon, authenticated;
revoke all on function public.trg_trips_create_counts()      from public, anon, authenticated;
revoke all on function public.trg_trip_likes_count()         from public, anon, authenticated;
revoke all on function public.trg_reposts_count()            from public, anon, authenticated;
revoke all on function public.trg_comment_likes_count()      from public, anon, authenticated;
revoke all on function public.trg_trip_comments_count()      from public, anon, authenticated;

revoke all on function public.get_feed(timestamptz, uuid, int)                    from public, anon;
revoke all on function public.get_trip_social(uuid)                               from public, anon;
revoke all on function public.get_comments(uuid, timestamptz, uuid, int)          from public, anon;
revoke all on function public.get_replies(uuid, timestamptz, uuid, int)           from public, anon;
revoke all on function public.get_saved_trips(timestamptz, uuid, int)             from public, anon;
revoke all on function public.get_trip_likers(uuid, timestamptz, uuid, int)       from public, anon;
revoke all on function public.set_trip_like(uuid, boolean)                        from public, anon;
revoke all on function public.set_trip_save(uuid, boolean)                        from public, anon;
revoke all on function public.set_comment_like(uuid, boolean)                     from public, anon;
revoke all on function public.create_comment(uuid, uuid, text)                    from public, anon;
revoke all on function public.delete_comment(uuid)                                from public, anon;
revoke all on function public.create_repost(uuid, text)                           from public, anon;
revoke all on function public.delete_repost(uuid)                                 from public, anon;

grant execute on function public.get_feed(timestamptz, uuid, int)                 to authenticated;
grant execute on function public.get_trip_social(uuid)                            to authenticated;
grant execute on function public.get_comments(uuid, timestamptz, uuid, int)       to authenticated;
grant execute on function public.get_replies(uuid, timestamptz, uuid, int)        to authenticated;
grant execute on function public.get_saved_trips(timestamptz, uuid, int)          to authenticated;
grant execute on function public.get_trip_likers(uuid, timestamptz, uuid, int)    to authenticated;
grant execute on function public.set_trip_like(uuid, boolean)                     to authenticated;
grant execute on function public.set_trip_save(uuid, boolean)                     to authenticated;
grant execute on function public.set_comment_like(uuid, boolean)                  to authenticated;
grant execute on function public.create_comment(uuid, uuid, text)                 to authenticated;
grant execute on function public.delete_comment(uuid)                             to authenticated;
grant execute on function public.create_repost(uuid, text)                        to authenticated;
grant execute on function public.delete_repost(uuid)                              to authenticated;

commit;
