-- Fix "structure of query does not match function result type" from
-- get_team_roster().
--
-- team_roster_view.total_xp is coalesce(x.total_xp, 0), where x.total_xp
-- (athlete_xp_totals.total_xp) is itself coalesce(sum(amount), 0) over
-- xp_ledger.amount (int) — sum(int) produces bigint, so the view's
-- total_xp column is bigint. get_team_roster() declared this column as
-- numeric, which Postgres treats as a real structural mismatch for a
-- RETURNS TABLE function (no implicit bigint->numeric coercion here).
--
-- This has likely been silently breaking get_team_roster() since Phase C —
-- it's one of three calls bundled in a Promise.all with no error handling
-- until a recent app.js fix added a try/catch, which is what finally
-- surfaced this error message instead of a silent "0" everywhere.
create or replace function get_team_roster(p_team_id uuid)
returns table(
  team_id uuid, athlete_id uuid, display_name text, total_xp numeric,
  workout_count bigint, last_workout_date date, status text
)
language plpgsql security definer set search_path = public as $$
begin
  if not (
    exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid())
    or exists (
      select 1 from team_members tm join athletes a on a.id = tm.athlete_id
      where tm.team_id = p_team_id and a.parent_profile_id = auth.uid()
    )
  ) then
    raise exception 'not authorized for this team roster';
  end if;
  return query select v.team_id, v.athlete_id, v.display_name, v.total_xp::numeric, v.workout_count, v.last_workout_date, v.status
    from team_roster_view v where v.team_id = p_team_id;
end $$;
