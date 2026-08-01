-- Level Up Athletics — Phase A: server-side functions
-- Run after 0003_views.sql.
--
-- All functions are SECURITY DEFINER with an explicit search_path (to avoid
-- search-path hijacking) and check auth.uid() internally rather than
-- trusting any passed-in profile id. Grants are applied at the bottom.

-- ---------- Join-code lookups ----------

-- Team join: creates a PENDING team_members row. Not instant — a coach must
-- approve/decline via decide_team_join() below.
-- NOTE: RETURNS TABLE column names must NOT match any column name used
-- inside the function body — PL/pgSQL turns them into variables in scope
-- for the whole function, and Postgres can't disambiguate an unqualified
-- column reference (most commonly inside ON CONFLICT (...) target lists)
-- from the same-named variable. Confirmed live: this broke
-- request_team_join's `on conflict (team_id, athlete_id)` with "column
-- reference team_id is ambiguous". Both functions below are prefixed
-- result_* to avoid this whole class of bug.
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
  where team_members.status = 'declined';
  return query select v_team.id, v_team.name, 'pending'::text;
end $$;

-- League join: instant attach, no approval step. Coach-only (attaches their
-- own team to a league they didn't necessarily create).
create or replace function join_league(p_team_id uuid, p_join_code text)
returns table(result_league_id uuid, result_league_name text)
language plpgsql security definer set search_path = public as $$
declare v_league leagues%rowtype;
begin
  if not exists (select 1 from teams where id = p_team_id and coach_profile_id = auth.uid()) then
    raise exception 'not authorized for this team';
  end if;
  select * into v_league from leagues where join_code = upper(trim(p_join_code));
  if v_league.id is null then raise exception 'invalid league code'; end if;
  insert into league_members(league_id, team_id) values (v_league.id, p_team_id)
  on conflict (team_id) do update set league_id = v_league.id, joined_at = now();
  update teams set league_id = v_league.id where id = p_team_id;
  return query select v_league.id, v_league.name;
end $$;

-- Coach decision on a pending team_members request.
create or replace function decide_team_join(p_team_member_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update team_members set
    status = case when p_approve then 'approved' else 'declined' end,
    decided_at = now(),
    decided_by = auth.uid()
  where id = p_team_member_id
    and team_id in (select id from teams where coach_profile_id = auth.uid());
  if not found then raise exception 'not authorized or request not found'; end if;
end $$;

-- ---------- PIN verification (step-up confirmation, separate from login) ----------

-- search_path includes "extensions" because Supabase installs pgcrypto
-- there by default, not in public — set search_path=public alone (the
-- pattern used everywhere else in this project) hides gen_salt()/crypt()
-- from these two functions specifically. Confirmed live: this broke PIN
-- setup with "function gen_salt(unknown) does not exist".
create or replace function set_approval_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4-6 digits'; end if;
  update profiles set approval_pin_hash = crypt(p_pin, gen_salt('bf')) where id = auth.uid();
end $$;

create or replace function verify_approval_pin(p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select approval_pin_hash into v_hash from profiles where id = auth.uid();
  if v_hash is null then return false; end if;
  return v_hash = crypt(p_pin, v_hash);
end $$;
-- verify_approval_pin is called internally, first line, by every
-- approval-gated function below — never trusted standalone from a prior
-- client-side call. It's also exposed for the client to do a fast pre-check
-- (better error UX), but no gated function skips its own internal re-check
-- just because this returned true moments earlier.

-- ---------- XP-ledger-writing actions ----------

-- Daily check-in: no PIN (frictionless, day-to-day action). Mirrors the
-- current app's $('#dailyForm') handler plus its attribute-points tally.
create or replace function log_daily_check_in(
  p_athlete_id uuid, p_date date, p_program_type text, p_program_id text,
  p_program_name text, p_exercise_data jsonb, p_attribute_points jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  insert into daily_check_ins(athlete_id, date, program_type, program_id, program_name, exercise_data, xp_awarded)
  values (p_athlete_id, p_date, p_program_type, p_program_id, p_program_name, p_exercise_data, 25)
  returning id into v_id;
  insert into xp_ledger(athlete_id, source, amount, note, ref_id)
  values (p_athlete_id, 'daily_check_in', 25, p_program_name, v_id);
  -- p_attribute_points: {"Strength": 4, "Core": 2, ...}
  insert into attribute_points_ledger(athlete_id, attribute, points, source)
  select p_athlete_id, key, (value::text)::int, v_id::text
  from jsonb_each(coalesce(p_attribute_points, '{}'::jsonb));
  -- Team Program's once-daily +50 XP bonus — only when something was
  -- actually logged (matches the old app's loggedSomething gate), and only
  -- once per day.
  if p_program_type = 'team' and coalesce(p_exercise_data, '{}'::jsonb) <> '{}'::jsonb and not exists (
    select 1 from xp_ledger where athlete_id = p_athlete_id and source = 'team_program_bonus'
      and created_at::date = p_date
  ) then
    insert into xp_ledger(athlete_id, source, amount, note)
    values (p_athlete_id, 'team_program_bonus', 50, p_program_name);
  end if;
  return v_id;
end $$;

-- Combine test submission: client always inserts as 'pending' directly (RLS
-- allows it). If a correct PIN is supplied in the same call, this function
-- verifies it immediately — mirrors the current app's single-step "enter
-- code inline while submitting" flow. No coach-grade input — see
-- record_combine_checkpoint's note below for why, and how tier-promotion
-- rating snapshots work instead.
create or replace function submit_combine_test(
  p_athlete_id uuid, p_week text, p_program_id text, p_program_name text,
  p_metrics jsonb, p_pin text
) returns table(id uuid, status text) language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_verified boolean := false;
begin
  if not exists (select 1 from athletes where athletes.id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if p_pin is not null and verify_approval_pin(p_pin) then v_verified := true; end if;
  insert into combine_tests(athlete_id, week, program_id, program_name, metrics, status, verified_by, verified_at)
  values (p_athlete_id, p_week, p_program_id, p_program_name, p_metrics,
          case when v_verified then 'verified' else 'pending' end,
          case when v_verified then auth.uid() else null end,
          case when v_verified then now() else null end)
  returning combine_tests.id into v_id;
  if v_verified then
    insert into xp_ledger(athlete_id, source, amount, note, ref_id) values (p_athlete_id, 'combine_verified', 75, p_program_name, v_id);
  end if;
  return query select v_id, case when v_verified then 'verified' else 'pending' end;
end $$;

-- Coach/parent verifies a previously-pending combine test (single-row
-- approval, and the bulk "approve all pending" flow calls this in a loop).
create or replace function verify_combine_test(p_combine_test_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare v_athlete_id uuid; v_program_name text;
begin
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  select athlete_id, program_name into v_athlete_id, v_program_name from combine_tests
    where id = p_combine_test_id and status = 'pending'
    and athlete_id in (select id from athletes where parent_profile_id = auth.uid());
  if v_athlete_id is null then raise exception 'not authorized or test not pending'; end if;
  update combine_tests set status = 'verified', verified_by = auth.uid(), verified_at = now()
    where id = p_combine_test_id;
  insert into xp_ledger(athlete_id, source, amount, note, ref_id)
  values (v_athlete_id, 'combine_verified', 75, v_program_name, p_combine_test_id)
  on conflict (source, ref_id) do nothing;
end $$;

-- Snapshots a CLIENT-COMPUTED overall rating against this verified Combine,
-- then tags all prior unattached attribute_points_ledger rows with this
-- checkpoint id so future completion-score queries (WHERE checkpoint_id IS
-- NULL) only see points earned since this moment. Mirrors the current
-- app's recordCombineCheckpoint(), which resets state.attributePoints to {}.
--
-- The rating is computed by the client (the same ratings() function that
-- paints the Player Card) and passed in, not recomputed here — that's how
-- this already worked before the Supabase migration (checkpoints were
-- always a client-side snapshot), and replicating the full rating engine
-- server-side would be large, high-risk, and only close a low-stakes gap
-- (no money/credentials involved) for a family/team-scale app. Client
-- calls this right after refreshing state and computing ratings().overall
-- with the newly-verified test already included.
create or replace function record_combine_checkpoint(p_athlete_id uuid, p_combine_test_id uuid, p_overall_rating int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_checkpoint_id uuid;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if not exists (select 1 from combine_tests where id = p_combine_test_id and athlete_id = p_athlete_id and status = 'verified') then
    raise exception 'combine test not found or not verified';
  end if;
  insert into combine_checkpoints(athlete_id, combine_test_id, overall_rating)
  values (p_athlete_id, p_combine_test_id, p_overall_rating) returning id into v_checkpoint_id;
  update attribute_points_ledger set checkpoint_id = v_checkpoint_id
    where athlete_id = p_athlete_id and checkpoint_id is null;
  return v_checkpoint_id;
end $$;

-- Quest/battle completion — PIN-gated (parent/coach approval required).
create or replace function complete_quest(p_athlete_id uuid, p_quest_id text, p_notes text, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare v_xp int;
begin
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if exists (
    select 1 from quest_completions
    where athlete_id = p_athlete_id and quest_id = p_quest_id
      and date_trunc('week', completed_at) = date_trunc('week', now())
  ) then raise exception 'quest already completed this week'; end if;
  select xp_value into v_xp from quests where id = p_quest_id;
  insert into quest_completions(athlete_id, quest_id, approved_by, notes)
  values (p_athlete_id, p_quest_id, auth.uid(), p_notes);
  insert into xp_ledger(athlete_id, source, amount, note)
  values (p_athlete_id, 'quest', v_xp, p_quest_id);
end $$;

-- Parent bonus XP — PIN-gated.
create or replace function award_bonus_xp(p_athlete_id uuid, p_bonus_type text, p_xp int, p_reason text, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  insert into xp_ledger(athlete_id, source, amount, note) values (p_athlete_id, 'bonus', p_xp, p_bonus_type || ': ' || coalesce(p_reason,''));
end $$;

-- Reward claim — PIN-gated, balance checked server-side.
create or replace function claim_reward(p_athlete_id uuid, p_reward_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare v_cost int; v_balance int;
begin
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  select xp_cost into v_cost from rewards where id = p_reward_id;
  select coalesce(total_xp,0)
    - (select coalesce(sum(r.xp_cost),0) from reward_claims rc join rewards r on r.id = rc.reward_id where rc.athlete_id = p_athlete_id)
    - (select coalesce(sum(xp_cost),0) from gear_purchases where athlete_id = p_athlete_id)
    into v_balance from athlete_xp_totals where athlete_id = p_athlete_id;
  if v_balance < v_cost then raise exception 'insufficient balance'; end if;
  insert into reward_claims(athlete_id, reward_id, approved_by) values (p_athlete_id, p_reward_id, auth.uid());
end $$;

-- Gear purchase — NOT PIN-gated (frictionless, matches the current app's
-- ungated buyGearItem()).
create or replace function buy_gear_item(p_athlete_id uuid, p_gear_item_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_cost int; v_balance int;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if exists (select 1 from gear_inventory where athlete_id = p_athlete_id and gear_item_id = p_gear_item_id) then
    raise exception 'already owned';
  end if;
  select xp_cost into v_cost from gear_items where id = p_gear_item_id;
  select coalesce(total_xp,0)
    - (select coalesce(sum(r.xp_cost),0) from reward_claims rc join rewards r on r.id = rc.reward_id where rc.athlete_id = p_athlete_id)
    - (select coalesce(sum(xp_cost),0) from gear_purchases where athlete_id = p_athlete_id)
    into v_balance from athlete_xp_totals where athlete_id = p_athlete_id;
  if v_balance < v_cost then raise exception 'insufficient balance'; end if;
  insert into gear_inventory(athlete_id, gear_item_id, acquired_via) values (p_athlete_id, p_gear_item_id, 'purchase');
  insert into gear_purchases(athlete_id, gear_item_id, xp_cost) values (p_athlete_id, p_gear_item_id, v_cost);
end $$;

-- Daily Mission — not PIN-gated. The 50/50 XP-vs-item roll happens
-- server-side (not client Math.random()) so it can't be replayed for free
-- gear.
create or replace function complete_daily_mission(p_athlete_id uuid, p_mission_title text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_already boolean; v_unowned text[]; v_item_id text; v_result jsonb;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  select exists(select 1 from xp_ledger where athlete_id=p_athlete_id and source='mission' and created_at::date = current_date) into v_already;
  if v_already then raise exception 'mission already complete today'; end if;
  select array_agg(id) into v_unowned from gear_items
    where id not in (select gear_item_id from gear_inventory where athlete_id = p_athlete_id);
  if v_unowned is not null and array_length(v_unowned,1) > 0 and random() < 0.5 then
    v_item_id := v_unowned[1 + floor(random() * array_length(v_unowned,1))::int];
    insert into gear_inventory(athlete_id, gear_item_id, acquired_via) values (p_athlete_id, v_item_id, 'mission_reward');
    v_result := jsonb_build_object('type','item','item_id', v_item_id);
  else
    insert into xp_ledger(athlete_id, source, amount, note) values (p_athlete_id, 'mission', 40, p_mission_title);
    v_result := jsonb_build_object('type','xp','xp',40);
  end if;
  return v_result;
end $$;

-- ---------- Grants ----------
-- Lock every function down from PUBLIC, then open only to authenticated users.
revoke all on function request_team_join(uuid, text) from public;
revoke all on function join_league(uuid, text) from public;
revoke all on function decide_team_join(uuid, boolean) from public;
revoke all on function set_approval_pin(text) from public;
revoke all on function verify_approval_pin(text) from public;
revoke all on function log_daily_check_in(uuid, date, text, text, text, jsonb, jsonb) from public;
revoke all on function submit_combine_test(uuid, text, text, text, jsonb, text) from public;
revoke all on function verify_combine_test(uuid, text) from public;
revoke all on function record_combine_checkpoint(uuid, uuid, int) from public;
revoke all on function complete_quest(uuid, text, text, text) from public;
revoke all on function award_bonus_xp(uuid, text, int, text, text) from public;
revoke all on function claim_reward(uuid, uuid, text) from public;
revoke all on function buy_gear_item(uuid, text) from public;
revoke all on function complete_daily_mission(uuid, text) from public;

grant execute on function request_team_join(uuid, text) to authenticated;
grant execute on function join_league(uuid, text) to authenticated;
grant execute on function decide_team_join(uuid, boolean) to authenticated;
grant execute on function set_approval_pin(text) to authenticated;
grant execute on function verify_approval_pin(text) to authenticated;
grant execute on function log_daily_check_in(uuid, date, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function submit_combine_test(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function verify_combine_test(uuid, text) to authenticated;
grant execute on function record_combine_checkpoint(uuid, uuid, int) to authenticated;
grant execute on function complete_quest(uuid, text, text, text) to authenticated;
grant execute on function award_bonus_xp(uuid, text, int, text, text) to authenticated;
grant execute on function claim_reward(uuid, uuid, text) to authenticated;
grant execute on function buy_gear_item(uuid, text) to authenticated;
grant execute on function complete_daily_mission(uuid, text) to authenticated;
