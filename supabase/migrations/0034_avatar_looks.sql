-- Level Up Athletics — saved Avatar Builder looks.
--
-- Until now an athlete's look (pose, uniform, hair, background, frame and so on)
-- lived only in the browser. This stores it with the athlete so it follows them
-- across devices and so teammates' lockers can draw their Player Card.
--
-- avatar_config is a small JSON object such as
--   {"pose":"ready","palette":"A","team":"green","outfit":"baseball","hair":true,
--    "cap":true,"glasses":false,"bg":"stadium","frame":"platinum"}
-- The browser decides what the values mean and ignores anything it does not
-- recognize, so new items never need a database change. The database only
-- guarantees it is a small JSON object, so a direct update cannot store junk.
alter table athletes add column if not exists avatar_config jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'athletes_avatar_config_shape') then
    alter table athletes add constraint athletes_avatar_config_shape
      check (avatar_config is null
             or (jsonb_typeof(avatar_config) = 'object' and octet_length(avatar_config::text) <= 800));
  end if;
end $$;

-- Looks for the locker room. Same access rule as get_clubhouse_roster(): the
-- team's coach, or a parent with an APPROVED athlete on the team. Returns only
-- approved, active members and only the look itself (no names, XP or status).
-- A separate function, so get_clubhouse_roster() does not change.
create or replace function get_clubhouse_looks(p_team_id uuid)
returns table(
  athlete_id uuid,
  avatar_config jsonb
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
    select a.id, a.avatar_config
    from team_members tm
    join athletes a on a.id = tm.athlete_id
    where tm.team_id = p_team_id and tm.status = 'approved' and a.archived_at is null
    order by a.id;
end $$;

revoke all on function get_clubhouse_looks(uuid) from public, anon;
grant execute on function get_clubhouse_looks(uuid) to authenticated;
