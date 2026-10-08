-- Level Up Athletics — Team Clubhouse roster.
--
-- Powers the locker room on the Team page. Returns ONLY approved, active
-- members (status filter and archived filter are enforced here, not in the
-- browser) and only what a locker shows: name, avatar photo, lifetime XP and
-- workouts logged. No OVR, rank, raw workout/combine records, last-workout
-- dates or join status.
--
-- Stricter than get_team_roster() on who may call it: the team's coach, or a
-- parent with an APPROVED athlete on this team. A parent whose athlete is
-- still pending (or was declined / left) is refused, so a join request alone
-- never reveals the roster or its avatars.
create or replace function get_clubhouse_roster(p_team_id uuid)
returns table(
  athlete_id uuid,
  display_name text,
  avatar_url text,
  total_xp numeric,
  workout_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not (
    exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid())
    or exists (
      select 1 from team_members tm
      join athletes a on a.id = tm.athlete_id
      where tm.team_id = p_team_id and tm.status = 'approved'
        and a.parent_profile_id = auth.uid() and a.archived_at is null
    )
  ) then
    raise exception 'not authorized for this team roster';
  end if;

  return query
    select a.id, a.display_name, a.avatar_url,
           coalesce(x.total_xp, 0)::numeric,
           coalesce(d.workout_count, 0)::bigint
    from team_members tm
    join athletes a on a.id = tm.athlete_id
    left join athlete_xp_totals x on x.athlete_id = a.id
    left join (
      select ci.athlete_id as ci_athlete_id, count(*) as workout_count
      from daily_check_ins ci group by ci.athlete_id
    ) d on d.ci_athlete_id = a.id
    where tm.team_id = p_team_id and tm.status = 'approved' and a.archived_at is null
    -- Stable, neutral order (never by XP or rating): alphabetical, ties by id.
    order by lower(a.display_name), a.id;
end $$;

revoke all on function get_clubhouse_roster(uuid) from public, anon;
grant execute on function get_clubhouse_roster(uuid) to authenticated;
