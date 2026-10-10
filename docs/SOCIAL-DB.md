# Social features: database design

Migration: `supabase/migrations/0005_social.sql` (rollback `.down.sql`, dev only, archives user data).
NOT applied to any remote database. UI spec: `docs/SOCIAL.md` (section 9 = data the UI needs).
After applying: `npm run gen:types` (types in `src/types/database.ts` are hand-written to match).

## 1. Decisions

| Topic | Decision | Why |
|---|---|---|
| Access | Login wall as 0001/0004: `anon` gets nothing (the app has no anon reads). All grants to `authenticated` only. | Consistency. |
| Visibility | Every social read derives from the trips policy (`exists (select 1 from trips t where t.id = ...)`), never a copy of the rule. Private trip => likes, comments, comment likes, reposts disappear for everyone but the owner; they reappear if the trip is public again (nothing deleted). | A trip that turns private cannot leak through its social rows. |
| Private trips, writes | No like, comment, comment-like, save or repost can be created on a non-public trip (RLS WITH CHECK `visibility = 'public'`). Un-like / un-save / delete own stay allowed. | Designer decision 5. |
| Own trip | Save and Repost of your own trip: refused (policy + RPC `OWN_TRIP`). Like and comment on your own trip: allowed (no self-like restriction; it is harmless, hiding it adds a check for no value). | Designer decisions 6, 8.8. |
| Repost target | `reposts.trip_id` is always the ORIGINAL trip. Unique `(user_id, trip_id)`: one repost per user per trip; the app passes the original id also from a repost card. Caption 1..280 after trim, else null. | Designer decision 6. |
| Repost of a trip that turns private / is deleted | Private: the repost row is hidden from everybody except its own reposter (who can still see and remove it, and whose feed join drops it). Deleted: reposts cascade-delete. **Difference from SOCIAL.md 2.2**: no "This trip is no longer available" placeholder row in the feed. The caption is the reposter's commentary about a trip that is now private, and a placeholder would still show who reposted what and say something about the trip. The placeholder UI code is simply never reached; `get_feed` never returns `trip = null`. | Privacy over a nicety; the reposter can still delete via `delete_repost`. |
| Delete parent comment | **Cascade**: the replies go with it (FK `ON DELETE CASCADE`), matching the designer's confirm dialog ("This also deletes its N replies"). I first considered a soft-delete placeholder; rejected because the confirm copy is already specified, it needs no extra column/state/RPC privilege, and counters stay trivially correct. | Simplicity + UI spec. |
| Who deletes | Comment author or trip owner, enforced by the DELETE policy; RPC `delete_comment` (SECURITY INVOKER) wraps it and returns the trip's new `comment_count`. No UPDATE grant exists on comments (no edit feature). | Owner decision 2. |
| One reply level | Composite FK `(parent_id, trip_id) -> trip_comments(id, trip_id)` forces the same trip. BEFORE INSERT trigger re-parents a reply-to-reply onto the top-level comment (UI prefixes "@username"). | Designer: "attaches to the top-level parent". |
| Saves | Private: SELECT policy `user_id = auth.uid()`. Public trip, not own. | Owner decision 4. |
| Mutations | Idempotent `set_*` / `create_*` / `delete_*` RPCs (SECURITY INVOKER) returning the canonical state and count, as SOCIAL.md section 8/9 asks. Direct table writes still work (same RLS) but the app should use the RPCs. | One round trip, count reconciles server-side, retries safe. |

## 2. Schema

| Table | PK / unique | FKs (all CASCADE) | Notes |
|---|---|---|---|
| `trip_likes` | PK `(trip_id, user_id)` | trips, profiles | Idx `(trip_id, created_at desc, user_id desc)` likers list; `(user_id, created_at desc)` throttle. |
| `trip_comments` | PK `id`; unique `(id, trip_id)` | trips; composite parent FK; profiles | `body` 1..500 non-blank; `like_count`, `reply_count` (trigger-kept, not writable by clients); reply cannot have `reply_count`. Idx partial `(trip_id, created_at desc, id desc) where parent_id is null` (page), partial `(parent_id, created_at, id) where parent_id is not null` (replies), `(trip_id)` (cascade), `(user_id, created_at desc)` (throttle). |
| `comment_likes` | PK `(comment_id, user_id)` | trip_comments, profiles | Idx `(user_id, created_at desc)`. |
| `trip_saves` | PK `(user_id, trip_id)` | profiles, trips | Idx `(user_id, created_at desc, trip_id desc)` saved list + throttle; `(trip_id)` cascade. |
| `reposts` | PK `id`; unique `(user_id, trip_id)` | profiles, trips | Idx `(created_at desc, id desc)` global feed branch; `(user_id, created_at desc, id desc)`; `(trip_id)` cascade. |
| `trip_social_counts` | PK `trip_id` | trips | `like_count`, `comment_count` (top-level + replies), `repost_count`; read-only for clients; row created by a trigger on `trips` (+ backfill in the migration). |

Column-level grants: clients can INSERT only the intended columns (`created_at`, counters, ids cannot be forged), SELECT, DELETE where applicable; the only UPDATE is `reposts.caption`. Counters are written by SECURITY DEFINER triggers only (`search_path = ''`, act only on the row being written).

## 3. Counters: denormalised, trigger-maintained (recommended and implemented)

- Feed shows 3 counts x 20 cards; count-on-read costs 60 index range scans per page and grows with virality. A counter table makes it a PK join.
- **Separate table, not columns on `trips`**: (a) `trips_update` lets the owner write any column of their trip, so counts on `trips` could be forged; (b) a like would update the wide `trips` row, fire `set_updated_at` (bumping `updated_at` on every like) and contend with the `FOR UPDATE` lock of `save_trip_stops` / `save_trip_route`.
- Comment `like_count` / `reply_count` live on `trip_comments` itself: no UPDATE grant for clients, so they cannot be forged.
- Race safety: counters change by `update ... set n = n + 1` in an AFTER trigger in the same transaction as the row (atomic, row-locked; no read-modify-write in app code). Deletes use `greatest(n - 1, 0)`. Cascade deletes (trip, profile, parent comment) run the same triggers; updates hit 0 rows when the target is already gone, so they never fail. The hot row of a viral trip serialises its likes; acceptable at this scale (revisit with sharded counters if a trip sees hundreds of likes per second).
- Drift repair (run in SQL editor if ever suspected):
  `update trip_social_counts c set like_count=(select count(*) from trip_likes l where l.trip_id=c.trip_id), comment_count=(select count(*) from trip_comments m where m.trip_id=c.trip_id), repost_count=(select count(*) from reposts r where r.trip_id=c.trip_id);`
- Counts shown are for what the viewer may see: counters are visible with the trip (RLS), and rows only exist for public-trip writes.

## 4. RLS summary

| Table | SELECT | INSERT | DELETE |
|---|---|---|---|
| `trip_social_counts` | trip visible | none (trigger) | none |
| `trip_likes` | trip visible | own, trip public | own |
| `trip_comments` | trip visible | own, trip public | author or trip owner |
| `comment_likes` | comment (hence trip) visible | own, comment's trip public | own |
| `trip_saves` | own rows only | own, trip public and not own | own |
| `reposts` | own rows, or trip visible | own, trip public and not own (UPDATE caption: own, trip public) | own |

`anon`: all revoked. `trip_social_counts`, comment rows etc. cannot be written by any other path.

## 5. Abuse limits

- Text: comment body 1..500 (trimmed, non-blank), repost caption 1..280 (DB CHECK + RPC, matches SOCIAL.md).
- Throttle: BEFORE INSERT trigger `social_throttle(per_minute, per_hour)` per user and table, serialised by an advisory lock so parallel requests cannot all pass: comments 10/min 120/h; reposts 10/min 30/h; trip likes, comment likes, saves 60/min 600/h. Error `RATE_LIMITED`, SQLSTATE `RL429`, `detail` = table name.
- Not counted: like/unlike churn (rows are deleted, so the window forgets them). A script can still toggle; each toggle costs two indexed writes and is bounded by PostgREST/auth limits. If it becomes a problem add an append-only action log like `route_requests`.
- Uniques stop double likes/saves/reposts. Self-like allowed (decided above). Blocking/reporting is out of scope for this phase.

## 6. Reads (all SECURITY INVOKER, keyset `(created_at, id)`, limit clamped 1..50)

Cursor rule: send both cursor params together; a row comparison with one missing returns an empty page.

| RPC | Returns | Cursor / order |
|---|---|---|
| `get_feed(p_before_created_at, p_before_id, p_limit)` | Union of public trips and reposts of public trips, one row per feed item with card data, counts, `liked_by_me`, `saved_by_me`, `reposted_by_me`, repost fields. | `(created_at, item_id)` of last row, newest first. |
| `get_trip_social(p_trip_id)` | 0 or 1 row: owner_id, counts, my three flags, `can_repost` (public and not mine). 0 rows = not visible. | - |
| `get_comments(p_trip_id, cursor, limit)` | Top-level comments + author profile, `like_count`, `reply_count`, `liked_by_me`, `can_delete`. | `(created_at, comment_id)`, newest first. |
| `get_replies(p_comment_id, p_after_created_at, p_after_id, limit)` | Replies, same shape. | **Forward** cursor, oldest first: pass the LAST row. |
| `get_saved_trips(cursor, limit)` | My saves joined to visible public trips (private/deleted drop out silently). | `(created_at = save time, trip_id)`, newest save first. |
| `get_trip_likers(p_trip_id, cursor, limit)` | Profiles `(user_id, username, display_name, avatar_path, created_at)`. | `(created_at, user_id)`. |

`get_feed` details: each branch (trips via `trips_feed_idx`, reposts via `reposts_feed_idx`) is limited to the page size before merging, so the work is one page; the page is then joined once to trips/profiles/counts, and the three `exists` flags use PK lookups. No N+1. The viewer can see an original and its repost(s) as separate items: dedupe is a UI choice.

Mutations:

| RPC | Result |
|---|---|
| `set_trip_like(p_trip_id, p_liked)` | `{liked, like_count}`; idempotent |
| `set_trip_save(p_trip_id, p_saved)` | `{saved}`; idempotent |
| `set_comment_like(p_comment_id, p_liked)` | `{liked, like_count}`; idempotent |
| `create_comment(p_trip_id, p_parent_id, p_body)` | the new row (get_comments shape) + `comment_count` |
| `delete_comment(p_comment_id)` | int, the trip's new `comment_count` (whole subtree subtracted) |
| `create_repost(p_trip_id, p_caption)` | `{repost_id, repost_count}`; existing repost returned unchanged (caption not overwritten) |
| `delete_repost(p_repost_id)` | `{trip_id, repost_count}`, 0 rows if already gone |

## 7. Error contract (stable, in `error.message`; SQLSTATE in `error.code`)

| message | SQLSTATE | UI mapping |
|---|---|---|
| `RATE_LIMITED` | `RL429` | "You're doing that too fast..."; keep composer text |
| `TRIP_UNAVAILABLE` | `42501` | trip private/deleted: remove from store, "This trip is private now." |
| `COMMENT_NOT_FOUND` | `42501` | comment gone / not allowed: remove locally |
| `OWN_TRIP` | `22023` | save/repost of own trip (UI never offers it) |
| `INVALID_PARENT` | `22023` | parent comment deleted meanwhile: refetch |
| `BAD_BODY`, `BAD_CAPTION` | `22023` | client validation bug |

A raw RLS refusal (direct table write) is also `42501`. Match on `error.code === 'RL429'` first, then `error.message`.

## 8. Concurrency and risks flagged

- Double tap / retries: unique PKs + `on conflict do nothing` + existence pre-check = idempotent; a unique violation `23505` on direct inserts must be treated as success.
- Reply vs parent delete: the guard trigger locks the parent row `FOR UPDATE` (reply fails with `INVALID_PARENT` if it is gone); parent delete cascades under the same lock order parent -> child.
- Concurrent replies to one parent: serialised by that lock (no share->update deadlock).
- Throttle uses `now()` (transaction start): fine for these windows.
- Comment/like/repost writes take a counter row lock on `trip_social_counts` for the rest of their transaction; they do NOT touch the `trips` row, so they do not block trip editing.
- N+1 risks for the coder: do not call `get_trip_social` per feed card (the feed already carries counts and flags); fetch replies only on expand; do not load likers per card.
- Account deletion cascades the user's comments (and their replies from others), likes, saves, reposts.
- Moving a trip to private then public again resurrects its comments/likes/reposts (by design).

## 9. Code the coder must update (checklist)

1. Owner applies `0005_social.sql` (SQL editor, once, after 0001-0004), then `npm run gen:types`; keep the type shapes above (e.g. `item_type` union).
2. `src/hooks/use-feed.ts`: it reads `get_feed` rows. Required changes: (a) cursor must be `{ p_before_created_at: last.created_at, p_before_id: last.item_id }` (today it sends `trip_id`, which would break paging once reposts exist); (b) dedupe/key by `item_id`, not `trip_id` (an original and its reposts share `trip_id`); (c) the delete/private event filter by `trip_id` can stay (removes every item of that trip); (d) map `item_type === 'repost'` rows to `RepostCard` (`repost_caption`, `reposter_*`, original card from the trip fields, `created_at` = repost time, `trip_created_at` = trip time); (e) seed the client social store with `like_count, comment_count, repost_count, liked_by_me, saved_by_me, reposted_by_me` per trip. The old columns keep their names and types.
3. Mutations through the RPCs in section 6 only; use returned `liked`/`like_count`/`comment_count` to reconcile the store; treat a repeat `create_repost` as success; remove repost by `repost_id` (feed row `item_id` when `item_type = 'repost'`).
4. Pass the ORIGINAL `trip_id` to `create_repost` / `set_trip_like` etc. from repost cards.
5. Trip detail: one `get_trip_social(id)` call (0 rows => unavailable state); hide Save/Repost when `owner_id` is me; `can_repost` is the source of truth.
6. Comments screen: `get_comments` (cursor `(created_at, comment_id)`), "View N replies" from `reply_count`, `get_replies` with the forward cursor, `create_comment` (send the tapped comment id as `p_parent_id`; use the returned `parent_id` to place the reply), `delete_comment` dialog count from `reply_count`, use the returned `comment_count`.
7. Likes list: `get_trip_likers`; avatars via `getAvatarUrl(avatar_path)`.
8. Saved tab: `get_saved_trips`; stop paging when rows < limit; no placeholder for dropped trips.
9. Error handling per section 7 (`RL429` first).
10. Client validation mirrors the limits: comment 1..500 after trim, caption <= 280.
11. Profile grid stays trips-only (reposts are feed-only per SOCIAL.md).
12. Tester: with two accounts verify private-trip flip hides likes/comments/reposts from the other account and restores them; own-trip save/repost refused; rate limit error code; cascade count after deleting a parent with 3 replies (`comment_count` drops by 4); concurrent double like leaves `like_count = 1`.
