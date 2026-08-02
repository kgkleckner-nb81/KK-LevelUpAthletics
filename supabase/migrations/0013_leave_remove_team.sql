-- Level Up Athletics — leave team / remove from roster.
--
-- Soft-status change only, same philosophy as archived_at on athletes
-- (0010_athlete_age_and_archive.sql): a hard delete of the team_members row
-- would be irreversible and would sever the only historical record of past
-- team membership, for no benefit — nothing else in the schema is keyed off
-- team_members at all (xp_ledger, daily_check_ins, combine_tests, quests,
-- rewards, gear are all athlete_id-only, never team-scoped), and every
-- roster/leaderboard/XP view already filters strictly on
-- status = 'approved', so a new terminal status value drops the athlete out
-- of the current roster/leaderboard/team totals everywhere with no other
-- code changes, while the row (and every athlete-owned table) stays intact.
alter table team_members drop constraint if exists team_members_status_check;
alter table team_members add constraint team_members_status_check
  check (status in ('pending','approved','declined','left'));

-- request_team_join's re-request upsert previously only fired for a prior
-- 'declined' row. Widen it so an athlete who left a team can rejoin it
-- later too — without this, that INSERT ... ON CONFLICT ... WHERE would
-- silently no-op against an existing 'left' row (condition doesn't match,
-- so neither the insert nor the update happens) and the join request would
-- appear to do nothing.
create or replace function request_team_join(p_athlete_id uuid, p_join_code text)
returns table(result_team_id uuid, result_team_name text, result_status text)
language plpgsql security definer set search_path = public as $$
declare v_team teams%rowtype;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  select * into v_team from teams where join_code = upper(trim(p_join_code));
  if v_team.id is null then
    raise exception 'invalid join code';
  end if;
  insert into team_members(team_id, athlete_id, status)
  values (v_team.id, p_athlete_id, 'pending')
  on conflict (team_id, athlete_id) do update set status = 'pending', requested_at = now(), decided_at = null, decided_by = null
  where team_members.status in ('declined','left');
  return query select v_team.id, v_team.name, 'pending'::text;
end $$;

-- Athlete/parent-facing "Leave Team". PIN-gated — same tier as the other
-- consequential parent-initiated account actions (archive_athlete, Team
-- Setup/Team Program saves), even though it's reversible via rejoin.
create or replace function leave_team(p_athlete_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  update team_members set status = 'left', decided_at = now(), decided_by = auth.uid()
    where athlete_id = p_athlete_id and status = 'approved'
    and athlete_id in (select id from athletes where parent_profile_id = auth.uid());
  if not found then raise exception 'not authorized or athlete is not on a team'; end if;
end $$;

-- Coach-facing "Remove from roster". Keyed on (team_id, athlete_id) rather
-- than the team_members row id, because that's exactly what the coach's
-- roster list already has on hand — it's rendered from get_team_roster()
-- (team_roster_view, 0003_views.sql), which returns team_id/athlete_id/
-- status per row but not the underlying team_members.id. Not PIN-gated —
-- matches the existing decide_team_join() precedent, where a coach's
-- team-membership decisions are already ungated in this app.
create or replace function remove_team_member(p_team_id uuid, p_athlete_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update team_members set status = 'left', decided_at = now(), decided_by = auth.uid()
    where team_id = p_team_id and athlete_id = p_athlete_id and status = 'approved'
    and team_id in (select id from teams where coach_profile_id = auth.uid());
  if not found then raise exception 'not authorized or member not found'; end if;
end $$;

revoke all on function leave_team(uuid, text) from public;
revoke all on function remove_team_member(uuid, uuid) from public;
grant execute on function leave_team(uuid, text) to authenticated;
grant execute on function remove_team_member(uuid, uuid) to authenticated;
