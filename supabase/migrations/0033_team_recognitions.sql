-- Level Up Athletics — Team recognitions (shared shout-outs).
--
-- Two kinds of positive, preset-only recognition, plus preset reactions:
--   award : official, given by the team's coach, approval PIN required.
--           Feeds Around the Clubhouse and Team Spotlight.
--   kudos : peer, given athlete -> teammate, no PIN, strict daily caps.
--           Feed only; never Spotlight.
--   reactions : one of each preset per athlete per recognition (toggle).
-- Cosmetic only: nothing here touches XP, the ledger or any award rules.
-- No free text anywhere — every label is checked against a preset list.
--
-- Same access model as the clubhouse roster: tables have RLS on and NO
-- client grants; everything goes through SECURITY DEFINER functions that
-- check who is calling. Only the team's coach and families of APPROVED,
-- active members can read; a pending/declined/left/archived athlete (or
-- their parent) sees nothing.

create table if not exists team_recognitions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  kind text not null check (kind in ('award','kudos')),
  label text not null,
  recipient_athlete_id uuid not null references athletes(id) on delete cascade,
  given_by_profile_id uuid references profiles(id),
  given_by_athlete_id uuid references athletes(id) on delete cascade,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references profiles(id),
  constraint team_recognitions_giver_shape check (
    (kind = 'award' and given_by_profile_id is not null and given_by_athlete_id is null)
    or (kind = 'kudos' and given_by_athlete_id is not null and given_by_profile_id is null)
  ),
  constraint team_recognitions_label_preset check (
    (kind = 'award' and label in ('Great Hustle','Best Teammate','Practice Leader','Sportsmanship','Never Quit'))
    or (kind = 'kudos' and label in ('Nice Work','Awesome','Good Teammate','Keep Going'))
  ),
  constraint team_recognitions_not_self check (given_by_athlete_id is distinct from recipient_athlete_id)
);
create index if not exists team_recognitions_team_recent on team_recognitions(team_id, created_at desc);
create index if not exists team_recognitions_giver_recent on team_recognitions(given_by_athlete_id, created_at desc);

create table if not exists team_recognition_reactions (
  recognition_id uuid not null references team_recognitions(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  reaction text not null check (reaction in ('clap','fire','raised','muscle','star')),
  created_at timestamptz not null default now(),
  primary key (recognition_id, athlete_id, reaction)
);

alter table team_recognitions enable row level security;
alter table team_recognition_reactions enable row level security;
revoke all on team_recognitions from anon, authenticated;
revoke all on team_recognition_reactions from anon, authenticated;

-- --------------------------------------------------------------------
-- helper: is this athlete an approved, active member of this team?
-- --------------------------------------------------------------------
create or replace function recognition_is_member(p_team_id uuid, p_athlete_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members tm join athletes a on a.id = tm.athlete_id
    where tm.team_id = p_team_id and tm.athlete_id = p_athlete_id
      and tm.status = 'approved' and a.archived_at is null
  )
$$;
revoke all on function recognition_is_member(uuid, uuid) from public, anon, authenticated;

-- --------------------------------------------------------------------
-- Coach award (PIN required)
-- --------------------------------------------------------------------
create or replace function give_team_award(
  p_team_id uuid, p_recipient_athlete_id uuid, p_award text, p_pin text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  if not exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid()) then
    raise exception 'not authorized: only this team''s coach can give an award';
  end if;
  if p_award is null or p_award not in ('Great Hustle','Best Teammate','Practice Leader','Sportsmanship','Never Quit') then
    raise exception 'invalid award';
  end if;
  if not recognition_is_member(p_team_id, p_recipient_athlete_id) then
    raise exception 'that athlete is not an approved member of this team';
  end if;
  if exists (
    select 1 from team_recognitions
    where team_id = p_team_id and kind = 'award' and label = p_award
      and recipient_athlete_id = p_recipient_athlete_id and removed_at is null
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'that award was already given to this athlete today';
  end if;
  if (select count(*) from team_recognitions
      where team_id = p_team_id and kind = 'award' and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'daily award limit reached for this team';
  end if;
  insert into team_recognitions(team_id, kind, label, recipient_athlete_id, given_by_profile_id)
    values (p_team_id, 'award', p_award, p_recipient_athlete_id, auth.uid())
    returning id into v_id;
  return v_id;
end $$;

-- --------------------------------------------------------------------
-- Peer kudos (no PIN; caps are the safeguard)
--   3 per athlete per rolling 24h, 1 per recipient per 24h, never to self.
--   Giver must be the caller's own approved athlete.
-- --------------------------------------------------------------------
create or replace function give_kudos(
  p_team_id uuid, p_giver_athlete_id uuid, p_recipient_athlete_id uuid, p_kudos text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from athletes where id = p_giver_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if p_kudos is null or p_kudos not in ('Nice Work','Awesome','Good Teammate','Keep Going') then
    raise exception 'invalid kudos';
  end if;
  if p_giver_athlete_id = p_recipient_athlete_id then
    raise exception 'you can''t give kudos to yourself';
  end if;
  if not recognition_is_member(p_team_id, p_giver_athlete_id)
     or not recognition_is_member(p_team_id, p_recipient_athlete_id) then
    raise exception 'both athletes must be approved members of this team';
  end if;
  if exists (
    select 1 from team_recognitions
    where kind = 'kudos' and given_by_athlete_id = p_giver_athlete_id
      and recipient_athlete_id = p_recipient_athlete_id and created_at > now() - interval '24 hours'
  ) then
    raise exception 'you already gave this teammate kudos today';
  end if;
  if (select count(*) from team_recognitions
      where kind = 'kudos' and given_by_athlete_id = p_giver_athlete_id
        and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'you''re out of kudos for today — come back tomorrow';
  end if;
  insert into team_recognitions(team_id, kind, label, recipient_athlete_id, given_by_athlete_id)
    values (p_team_id, 'kudos', p_kudos, p_recipient_athlete_id, p_giver_athlete_id)
    returning id into v_id;
  return v_id;
end $$;

-- --------------------------------------------------------------------
-- Reactions: toggle one preset on a recognition. Returns true when added,
-- false when removed. Reacting can never create feed items.
-- --------------------------------------------------------------------
create or replace function react_to_recognition(
  p_athlete_id uuid, p_recognition_id uuid, p_reaction text
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if p_reaction is null or p_reaction not in ('clap','fire','raised','muscle','star') then
    raise exception 'invalid reaction';
  end if;
  select team_id into v_team from team_recognitions where id = p_recognition_id and removed_at is null;
  if v_team is null or not recognition_is_member(v_team, p_athlete_id) then
    raise exception 'recognition not available';
  end if;
  if exists (select 1 from team_recognition_reactions
             where recognition_id = p_recognition_id and athlete_id = p_athlete_id and reaction = p_reaction) then
    delete from team_recognition_reactions
      where recognition_id = p_recognition_id and athlete_id = p_athlete_id and reaction = p_reaction;
    return false;
  end if;
  insert into team_recognition_reactions(recognition_id, athlete_id, reaction)
    values (p_recognition_id, p_athlete_id, p_reaction);
  return true;
end $$;

-- --------------------------------------------------------------------
-- Coach removal (PIN required). Soft: row stays for audit, never shown.
-- --------------------------------------------------------------------
create or replace function remove_team_recognition(p_recognition_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  select team_id into v_team from team_recognitions where id = p_recognition_id;
  if v_team is null or not exists (select 1 from teams where id = v_team and coach_profile_id = auth.uid()) then
    raise exception 'not authorized: only this team''s coach can remove a recognition';
  end if;
  update team_recognitions set removed_at = now(), removed_by = auth.uid()
    where id = p_recognition_id and removed_at is null;
end $$;

-- --------------------------------------------------------------------
-- Reading: coach of the team, or a parent with an APPROVED active athlete
-- on it. Rows are limited to recognitions whose people are still approved
-- active members (someone who leaves disappears from the feed).
-- --------------------------------------------------------------------
create or replace function recognition_can_read(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid())
    or exists (
      select 1 from team_members tm join athletes a on a.id = tm.athlete_id
      where tm.team_id = p_team_id and tm.status = 'approved'
        and a.parent_profile_id = auth.uid() and a.archived_at is null
    )
  )
$$;
revoke all on function recognition_can_read(uuid) from public, anon, authenticated;

create or replace function get_team_recognitions(
  p_team_id uuid, p_athlete_id uuid default null, p_limit int default 30
) returns table(
  id uuid, kind text, label text, created_at timestamptz,
  recipient_athlete_id uuid, recipient_name text, recipient_avatar_url text,
  giver_name text, reaction_counts jsonb, my_reactions text[]
) language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  if not recognition_can_read(p_team_id) then raise exception 'not authorized for this team'; end if;
  -- "my reactions" only for an athlete the caller actually owns.
  if p_athlete_id is not null
     and exists (select 1 from athletes ath where ath.id = p_athlete_id and ath.parent_profile_id = auth.uid()) then
    v_me := p_athlete_id;
  end if;
  return query
    select r.id, r.kind, r.label, r.created_at,
           r.recipient_athlete_id, ra.display_name, ra.avatar_url,
           case when r.kind = 'award' then 'Coach' else ga.display_name end,
           coalesce((select jsonb_object_agg(x.reaction, x.n) from (
             select rr.reaction, count(*)::int as n from team_recognition_reactions rr
             where rr.recognition_id = r.id group by rr.reaction) x), '{}'::jsonb),
           coalesce(array(select rr.reaction from team_recognition_reactions rr
                          where rr.recognition_id = r.id and rr.athlete_id = v_me), '{}'::text[])
    from team_recognitions r
    join athletes ra on ra.id = r.recipient_athlete_id
    left join athletes ga on ga.id = r.given_by_athlete_id
    where r.team_id = p_team_id and r.removed_at is null
      and recognition_is_member(p_team_id, r.recipient_athlete_id)
      and (r.kind = 'award' or recognition_is_member(p_team_id, r.given_by_athlete_id))
    order by r.created_at desc, r.id
    limit least(greatest(coalesce(p_limit, 30), 1), 50);
end $$;

-- Team Spotlight: the most recent COACH AWARD from the last 7 days.
create or replace function get_team_spotlight(p_team_id uuid)
returns table(
  id uuid, label text, created_at timestamptz,
  recipient_athlete_id uuid, recipient_name text, recipient_avatar_url text
) language plpgsql security definer set search_path = public as $$
begin
  if not recognition_can_read(p_team_id) then raise exception 'not authorized for this team'; end if;
  return query
    select r.id, r.label, r.created_at, r.recipient_athlete_id, ra.display_name, ra.avatar_url
    from team_recognitions r
    join athletes ra on ra.id = r.recipient_athlete_id
    where r.team_id = p_team_id and r.kind = 'award' and r.removed_at is null
      and r.created_at > now() - interval '7 days'
      and recognition_is_member(p_team_id, r.recipient_athlete_id)
    order by r.created_at desc, r.id
    limit 1;
end $$;

revoke all on function give_team_award(uuid, uuid, text, text) from public, anon;
revoke all on function give_kudos(uuid, uuid, uuid, text) from public, anon;
revoke all on function react_to_recognition(uuid, uuid, text) from public, anon;
revoke all on function remove_team_recognition(uuid, text) from public, anon;
revoke all on function get_team_recognitions(uuid, uuid, int) from public, anon;
revoke all on function get_team_spotlight(uuid) from public, anon;
grant execute on function give_team_award(uuid, uuid, text, text) to authenticated;
grant execute on function give_kudos(uuid, uuid, uuid, text) to authenticated;
grant execute on function react_to_recognition(uuid, uuid, text) to authenticated;
grant execute on function remove_team_recognition(uuid, text) to authenticated;
grant execute on function get_team_recognitions(uuid, uuid, int) to authenticated;
grant execute on function get_team_spotlight(uuid) to authenticated;
