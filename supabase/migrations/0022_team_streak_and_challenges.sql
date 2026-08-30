-- Level Up Athletics — Team Streak + Team Challenge.
--
-- Team Streak: consecutive days where ANY approved teammate logged a
-- workout (any daily_check_ins row). Deliberately team-wide, not
-- per-athlete, and deliberately forgiving (any one teammate keeps it
-- alive). The client walks a Set<date> backward day-by-day, mirroring
-- the existing personal streak() in app.js exactly — only the source of
-- the date set differs (get_team_active_dates() below instead of
-- state.daily). That RPC returns bare dates with NO athlete identity and
-- NO raw check-in content attached — this is a deliberate privacy
-- boundary already established in this project (see 0003_views.sql /
-- get_team_roster): a parent only ever sees a NARROWED aggregate view of
-- teammates, never raw per-athlete rows. "days someone on the team
-- worked out" with no names attached is aggregate-safe under that same
-- boundary; a per-athlete list would not be. Do not widen this RPC to
-- return athlete_id.
--
-- Team Challenge: one active challenge per team at a time, either
-- system-generated (zero coach effort, deterministic weekly pick from a
-- hardcoded server-trusted pool — see get_or_create_active_team_challenge)
-- or coach-curated (PIN-gated, replaces whatever's currently active).
-- Progress is a LIVE sum of xp_ledger for the approved roster, computed
-- on every read — no separate progress column, no cron, matching this
-- project's "no server framework beyond on-demand RPCs" constraint. This
-- is purely additive: it never deducts from or locks an athlete's
-- personal spendable XP balance, it just reads the same ledger rows that
-- already feed the Gear Locker/Reward Locker balance.
--
-- FOOTGUN WARNING (see 0011_fix_team_totals_rls.sql for the two prior
-- incidents): get_or_create_active_team_challenge's RETURNS TABLE uses
-- column names that match team_challenges' real column names (title,
-- status, target_xp, ends_at, ...). plpgsql creates an implicit variable
-- per RETURNS TABLE column, so ANY bare (unqualified) reference to those
-- column names anywhere in the function body collides with the implicit
-- variable and raises "column reference is ambiguous". Every table
-- reference in these functions is qualified with a table alias (tc./tm./
-- x./v_row.) for exactly this reason — do not "simplify" that away.

-- ---------------- team_challenges ----------------
create table if not exists team_challenges (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  kind text not null check (kind in ('system','coach')),
  title text not null,
  target_xp int not null check (target_xp > 0),
  eligible_sources text[] not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null check (status in ('active','completed','expired')) default 'active',
  reward_type text not null check (reward_type in ('gear','custom')),
  reward_gear_item_id text references gear_items(id),
  reward_description text,
  completed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint team_challenges_reward_shape check (
    (reward_type = 'gear' and reward_gear_item_id is not null and reward_description is null)
    or (reward_type = 'custom' and reward_description is not null and reward_gear_item_id is null)
  )
);

-- Enforces "one active challenge per team" and is also the concurrency
-- guard for get_or_create_active_team_challenge's insert-if-missing step.
create unique index if not exists team_challenges_active_team_idx
  on team_challenges(team_id) where status = 'active';
create index if not exists team_challenges_team_id_idx on team_challenges(team_id);

alter table team_challenges enable row level security;
-- Deliberately ZERO policies and ZERO grants to anon/authenticated.
-- xp_ledger's precedent is "SELECT only, no insert policy" (client reads
-- the view, server-side functions write); team_challenges goes one step
-- further and has no direct client SELECT either, because status/progress
-- must always be computed live through the RPCs below, never read as a
-- raw row (a raw read would show a stale status, or worse, let a client
-- bypass the completion/reward-grant side effects entirely).
revoke all on team_challenges from anon, authenticated;

-- ---------------- gear_inventory.acquired_via widen ----------------
-- Same drop/add pattern 0013_leave_remove_team.sql used for
-- team_members_status_check.
alter table gear_inventory drop constraint if exists gear_inventory_acquired_via_check;
alter table gear_inventory add constraint gear_inventory_acquired_via_check
  check (acquired_via in ('purchase','mission_reward','team_challenge'));

-- ================================================================
-- get_team_active_dates(p_team_id) — bare dates only, no athlete
-- identity. RETURNS setof date has NO named output columns, so this
-- function is not exposed to the RETURNS TABLE footgun at all — plain
-- plpgsql is safe here regardless of qualification style, but table
-- refs are still qualified for consistency.
-- ================================================================
create or replace function get_team_active_dates(p_team_id uuid)
returns setof date
language plpgsql security definer set search_path = public as $$
begin
  if not (
    exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid())
    or exists (
      select 1 from team_members tm join athletes a on a.id = tm.athlete_id
      where tm.team_id = p_team_id and a.parent_profile_id = auth.uid()
    )
  ) then
    raise exception 'not authorized for this team';
  end if;

  return query
    select distinct dci.date
    from daily_check_ins as dci
    join team_members as tm
      on tm.athlete_id = dci.athlete_id and tm.team_id = p_team_id and tm.status = 'approved'
    where dci.date >= (current_date - interval '400 days')
    order by dci.date desc;
end $$;

revoke all on function get_team_active_dates(uuid) from public;
grant execute on function get_team_active_dates(uuid) to authenticated;

-- ================================================================
-- get_or_create_active_team_challenge(p_team_id) — the one function
-- that does everything: auth check, lazy expiry, lazy system-generation
-- if the slot is free, live progress sum, lazy completion, idempotent
-- reward grant (re-runs on every read of a completed gear-reward
-- challenge, not just once at transition, so a late-approved teammate
-- still gets the gear).
-- ================================================================
create or replace function get_or_create_active_team_challenge(p_team_id uuid)
returns table(
  challenge_id uuid,
  kind text,
  title text,
  target_xp int,
  eligible_sources text[],
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  reward_type text,
  reward_gear_item_id text,
  reward_description text,
  completed_at timestamptz,
  progress_xp numeric
)
language plpgsql security definer set search_path = public as $$
declare
  v_row team_challenges%rowtype;
  v_progress numeric;
  v_pool_idx int;
  v_title text; v_target int; v_sources text[]; v_duration int;
begin
  if not (
    exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid())
    or exists (
      select 1 from team_members tm join athletes a on a.id = tm.athlete_id
      where tm.team_id = p_team_id and a.parent_profile_id = auth.uid()
    )
  ) then
    raise exception 'not authorized for this team';
  end if;

  -- Lazy expire: an active challenge past its window is no longer active,
  -- freeing the slot for a new pick on the next step.
  update team_challenges as tc
    set status = 'expired'
    where tc.team_id = p_team_id and tc.status = 'active' and tc.ends_at < now();

  -- The row currently "occupying" the team's one-challenge slot: active,
  -- or completed-but-still-inside-its-original-window (keeps the
  -- celebration up for the rest of the run instead of yanking it the
  -- instant the target is hit).
  select tc.* into v_row from team_challenges as tc
    where tc.team_id = p_team_id
      and (tc.status = 'active' or (tc.status = 'completed' and tc.ends_at >= now()))
    order by tc.created_at desc limit 1;

  if not found then
    -- Deterministic system pick keyed by (team_id, ISO week) — same
    -- pick shown to every viewer of this team all week, no cron needed.
    -- Pool is hardcoded here (server-trusted), NOT in app.js, so no
    -- client can fabricate an arbitrary "system" challenge or reward.
    -- System challenges never carry a gear reward (see plan notes) —
    -- gear-as-reward is reserved for the coach-curated path.
    v_pool_idx := abs(hashtext(p_team_id::text || to_char(now(), 'IYYY-IW'))) % 5;
    select p.title, p.target_xp, p.eligible_sources, p.duration_days
      into v_title, v_target, v_sources, v_duration
      from (values
        (0,'Workout Warmup',      500, array['daily_check_in','team_program_bonus','mission']::text[], 7),
        (1,'Arcade Rally',        300, array['arcade_game','spin']::text[], 5),
        (2,'Quest & Battle Rush', 400, array['quest','bonus']::text[], 7),
        (3,'Combine Crunch',      250, array['combine_verified']::text[], 10),
        (4,'All-Around Grind',    800, array['daily_check_in','team_program_bonus','mission',
                                             'arcade_game','spin','quest','bonus','combine_verified']::text[], 14)
      ) as p(idx, title, target_xp, eligible_sources, duration_days)
      where p.idx = v_pool_idx;

    insert into team_challenges(
      team_id, kind, title, target_xp, eligible_sources, starts_at, ends_at, status,
      reward_type, reward_description
    ) values (
      p_team_id, 'system', v_title, v_target, v_sources, now(),
      now() + (v_duration || ' days')::interval, 'active',
      'custom', 'Bragging rights for the whole team!'
    )
    on conflict (team_id) where status = 'active' do nothing;

    select tc.* into v_row from team_challenges as tc
      where tc.team_id = p_team_id
        and (tc.status = 'active' or (tc.status = 'completed' and tc.ends_at >= now()))
      order by tc.created_at desc limit 1;
  end if;

  -- Live progress: sum xp_ledger for the CURRENTLY approved roster,
  -- filtered to this challenge's eligible sources, within its window.
  -- This is a pure read of already-existing XP — it never deducts from
  -- or locks any athlete's personal spendable balance.
  select coalesce(sum(x.amount), 0) into v_progress
    from xp_ledger as x
    join team_members as tm
      on tm.athlete_id = x.athlete_id and tm.team_id = p_team_id and tm.status = 'approved'
    where x.source = any(v_row.eligible_sources)
      and x.created_at >= v_row.starts_at
      and x.created_at <= v_row.ends_at;

  -- Lazy completion. WHERE tc.status = 'active' makes this UPDATE its own
  -- race guard: if two calls land at once, only the first actually
  -- changes a row; the second affects zero rows and re-reads the same
  -- completed row below.
  if v_row.status = 'active' and v_progress >= v_row.target_xp then
    update team_challenges as tc
      set status = 'completed', completed_at = now()
      where tc.id = v_row.id and tc.status = 'active'
      returning tc.* into v_row;
  end if;

  -- Idempotent reward grant. Re-runs on EVERY read of a completed
  -- gear-reward challenge (not gated on "just transitioned") so a
  -- teammate approved after completion still gets the gear on their
  -- next Team HQ load. Cheap: tiny roster, unique-index conflict check.
  if v_row.status = 'completed' and v_row.reward_type = 'gear' then
    insert into gear_inventory(athlete_id, gear_item_id, acquired_via)
      select tm.athlete_id, v_row.reward_gear_item_id, 'team_challenge'
      from team_members as tm
      where tm.team_id = p_team_id and tm.status = 'approved'
      on conflict (athlete_id, gear_item_id) do nothing;
  end if;

  return query select
    v_row.id, v_row.kind, v_row.title, v_row.target_xp, v_row.eligible_sources,
    v_row.starts_at, v_row.ends_at, v_row.status, v_row.reward_type,
    v_row.reward_gear_item_id, v_row.reward_description, v_row.completed_at, v_progress;
end $$;

revoke all on function get_or_create_active_team_challenge(uuid) from public;
grant execute on function get_or_create_active_team_challenge(uuid) to authenticated;

-- ================================================================
-- set_team_coach_challenge — PIN-gated (server-side, real gate, since
-- team_challenges has no RLS policy at all: this RPC IS the only
-- authorization boundary, unlike team_programs where RLS is the real
-- backstop and the PIN is only a client-side nicety). Replaces whatever
-- currently occupies the team's slot (active, or completed-and-still-
-- in-window).
-- ================================================================
create or replace function set_team_coach_challenge(
  p_team_id uuid,
  p_title text,
  p_target_xp int,
  p_eligible_sources text[],
  p_duration_days int,
  p_reward_type text,
  p_reward_gear_item_id text,
  p_reward_description text,
  p_pin text
)
returns table(
  challenge_id uuid, kind text, title text, target_xp int, eligible_sources text[],
  starts_at timestamptz, ends_at timestamptz, status text,
  reward_type text, reward_gear_item_id text, reward_description text, completed_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare v_new_id uuid;
begin
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;

  if not exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid()) then
    raise exception 'not authorized: only this team''s coach can set a challenge';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title required';
  end if;
  if p_target_xp is null or p_target_xp <= 0 then
    raise exception 'target_xp must be positive';
  end if;
  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 60 then
    raise exception 'duration_days must be between 1 and 60';
  end if;
  if p_eligible_sources is null or array_length(p_eligible_sources,1) is null then
    raise exception 'pick at least one activity category';
  end if;
  if not (p_eligible_sources <@ array[
    'daily_check_in','team_program_bonus','mission',
    'arcade_game','spin','quest','bonus','combine_verified'
  ]) then
    raise exception 'invalid eligible source';
  end if;
  if p_reward_type not in ('gear','custom') then
    raise exception 'invalid reward_type';
  end if;
  if p_reward_type = 'gear' then
    if p_reward_gear_item_id is null or not exists (
      select 1 from gear_items as gi where gi.id = p_reward_gear_item_id
    ) then
      raise exception 'invalid reward_gear_item_id';
    end if;
    p_reward_description := null;
  else
    if p_reward_description is null or length(trim(p_reward_description)) = 0 then
      raise exception 'reward_description required';
    end if;
    p_reward_gear_item_id := null;
  end if;

  -- Coach-curated replaces whatever occupies the slot right now.
  update team_challenges as tc
    set status = 'expired'
    where tc.team_id = p_team_id
      and (tc.status = 'active' or (tc.status = 'completed' and tc.ends_at >= now()));

  insert into team_challenges(
    team_id, kind, title, target_xp, eligible_sources, starts_at, ends_at, status,
    reward_type, reward_gear_item_id, reward_description, created_by
  ) values (
    p_team_id, 'coach', trim(p_title), p_target_xp, p_eligible_sources, now(),
    now() + (p_duration_days || ' days')::interval, 'active',
    p_reward_type, p_reward_gear_item_id, p_reward_description, auth.uid()
  ) returning id into v_new_id;

  return query select
    tc.id, tc.kind, tc.title, tc.target_xp, tc.eligible_sources, tc.starts_at, tc.ends_at, tc.status,
    tc.reward_type, tc.reward_gear_item_id, tc.reward_description, tc.completed_at
    from team_challenges as tc where tc.id = v_new_id;
end $$;

revoke all on function set_team_coach_challenge(uuid,text,int,text[],int,text,text,text,text) from public;
grant execute on function set_team_coach_challenge(uuid,text,int,text[],int,text,text,text,text) to authenticated;
