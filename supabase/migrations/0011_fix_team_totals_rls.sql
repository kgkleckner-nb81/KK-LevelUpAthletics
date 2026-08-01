-- Level Up Athletics — fix team_xp_totals/league_team_totals reading as 0.
--
-- team_roster_view (0003_views.sql) already needed a wrapping SECURITY
-- DEFINER function (get_team_roster) because a view can't carry its own
-- RLS policy — access had to be gated by a function instead. team_xp_totals
-- and league_team_totals were left as plain views with a direct
-- `grant select ... to authenticated`, on the assumption that a view
-- defaults to running as its owner (postgres, who owns every underlying
-- table and therefore bypasses RLS on all of them) regardless of who
-- queries it.
--
-- Confirmed live: that assumption didn't hold — querying these views
-- directly as `authenticated` returned athlete_count=0 for every team,
-- even for a team the querying user's own athlete is an approved member
-- of, while the identical query run in the SQL editor (as postgres)
-- returned the correct count. Rather than chase the exact RLS/ownership
-- interaction, apply the same fix that already works for team_roster_view:
-- read these views only through SECURITY DEFINER functions, which always
-- execute with the definer's (postgres's) rights no matter who calls them.
--
-- language sql (not plpgsql) deliberately — a RETURNS TABLE(team_id ...)
-- in plpgsql creates an implicit variable named team_id that collides with
-- a bare `team_id` column reference (the exact bug already hit twice this
-- project in submit_combine_test and get_team_roster's sibling functions).
-- Plain SQL functions have no such variable-scoping step, so the `v.`
-- alias below is enough on its own.
create or replace function get_team_xp_totals(p_team_id uuid)
returns table(team_id uuid, team_name text, athlete_count bigint, team_xp numeric, avg_workouts numeric)
language sql security definer set search_path = public as $$
  select v.team_id, v.team_name, v.athlete_count, v.team_xp, v.avg_workouts
  from team_xp_totals v
  where v.team_id = p_team_id;
$$;
revoke all on function get_team_xp_totals(uuid) from public;
grant execute on function get_team_xp_totals(uuid) to authenticated;

create or replace function get_all_team_xp_totals_ranked()
returns table(team_id uuid, team_name text, athlete_count bigint, team_xp numeric, avg_workouts numeric)
language sql security definer set search_path = public as $$
  select v.team_id, v.team_name, v.athlete_count, v.team_xp, v.avg_workouts
  from team_xp_totals v
  order by v.team_xp desc;
$$;
revoke all on function get_all_team_xp_totals_ranked() from public;
grant execute on function get_all_team_xp_totals_ranked() to authenticated;

create or replace function get_league_team_totals(p_league_id uuid)
returns table(league_id uuid, league_name text, team_id uuid, team_name text, team_xp numeric, athlete_count bigint)
language sql security definer set search_path = public as $$
  select v.league_id, v.league_name, v.team_id, v.team_name, v.team_xp, v.athlete_count
  from league_team_totals v
  where v.league_id = p_league_id
  order by v.team_xp desc;
$$;
revoke all on function get_league_team_totals(uuid) from public;
grant execute on function get_league_team_totals(uuid) to authenticated;

-- Direct view access no longer needed (nor reliable) now that everything
-- reads through the functions above.
revoke all on team_xp_totals from authenticated;
revoke all on league_team_totals from authenticated;
