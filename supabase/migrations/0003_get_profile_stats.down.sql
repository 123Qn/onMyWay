-- DEV ONLY rollback of 0003_get_profile_stats.sql. Drops a function only; no data is touched.
begin;
drop function if exists public.get_profile_stats(uuid);
commit;
