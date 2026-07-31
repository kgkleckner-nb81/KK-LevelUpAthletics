-- Level Up Athletics — Phase A: dashboard views
-- Run after 0002_rls_policies.sql.
--
-- These are plain views, computed on every read (not materialized) — this
-- keeps Team/League HQ numbers always-correct without a separate refresh
-- step. At pilot scale (a handful of teams/leagues) this is fine; swap to a
-- materialized view later, without touching app.js, only if it's ever slow.

create view athlete_xp_totals as
select athlete_id, coalesce(sum(amount),0) as total_xp
from xp_ledger
group by athlete_id;

-- Narrowed coach roster view: name + aggregate stats only, never raw
-- workout/combine/quest rows. This is the chosen alternative to giving
-- coaches direct SELECT on athletes/combine_tests/daily_check_ins.
-- It runs as the view owner (postgres) so it can read across tables a coach
-- has no direct grant on.
--
-- Postgres does NOT support `CREATE POLICY` on a view (RLS policies only
-- attach to real tables) — that was tried and correctly rejected. Instead,
-- this view is left with NO grant to authenticated/anon/public at all, and
-- access is gated entirely through the get_team_roster() function below,
-- which checks authorization first and only then reads from the view. The
-- view itself is just a shared query definition, never queried directly by
-- a client.
create view team_roster_view
with (security_invoker = false) as
select
  tm.team_id,
  a.id as athlete_id,
  a.display_name,
  coalesce(x.total_xp, 0) as total_xp,
  coalesce(d.workout_count, 0) as workout_count,
  coalesce(d.last_workout_date, null) as last_workout_date,
  tm.status
from team_members tm
join athletes a on a.id = tm.athlete_id
left join athlete_xp_totals x on x.athlete_id = a.id
left join (
  select athlete_id, count(*) as workout_count, max(date) as last_workout_date
  from daily_check_ins group by athlete_id
) d on d.athlete_id = a.id;

alter view team_roster_view owner to postgres;
revoke all on team_roster_view from public, anon, authenticated;

create or replace function get_team_roster(p_team_id uuid)
returns table(
  team_id uuid,
  athlete_id uuid,
  display_name text,
  total_xp numeric,
  workout_count bigint,
  last_workout_date date,
  status text
)
language plpgsql security definer set search_path = public as $$
begin
  if not (
    exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid())
    or exists (
      select 1 from team_members tm
      join athletes a on a.id = tm.athlete_id
      where tm.team_id = p_team_id and a.parent_profile_id = auth.uid()
    )
  ) then
    raise exception 'not authorized for this team roster';
  end if;
  return query select v.team_id, v.athlete_id, v.display_name, v.total_xp, v.workout_count, v.last_workout_date, v.status
    from team_roster_view v where v.team_id = p_team_id;
end $$;

revoke all on function get_team_roster(uuid) from public;
grant execute on function get_team_roster(uuid) to authenticated;

create view team_xp_totals as
select
  t.id as team_id,
  t.name as team_name,
  count(distinct tm.athlete_id) filter (where tm.status = 'approved') as athlete_count,
  coalesce(sum(x.total_xp) filter (where tm.status = 'approved'), 0) as team_xp,
  coalesce(avg(d.workout_count) filter (where tm.status = 'approved'), 0) as avg_workouts
from teams t
left join team_members tm on tm.team_id = t.id
left join athlete_xp_totals x on x.athlete_id = tm.athlete_id
left join (
  select athlete_id, count(*) as workout_count from daily_check_ins group by athlete_id
) d on d.athlete_id = tm.athlete_id
group by t.id, t.name;
grant select on team_xp_totals to authenticated;

create view league_team_totals as
select
  l.id as league_id, l.name as league_name,
  t.id as team_id, t.name as team_name,
  coalesce(tx.team_xp, 0) as team_xp,
  coalesce(tx.athlete_count, 0) as athlete_count
from leagues l
join league_members lm on lm.league_id = l.id
join teams t on t.id = lm.team_id
left join team_xp_totals tx on tx.team_id = t.id;
grant select on league_team_totals to authenticated;
