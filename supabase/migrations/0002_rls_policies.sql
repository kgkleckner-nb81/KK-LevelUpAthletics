-- Level Up Athletics — Phase A: Row Level Security
-- Run after 0001_schema.sql.
--
-- Design: `athletes` (and everything scoped under it) is parent-only for
-- direct SELECT — a coach never reads it directly, only through the
-- narrowed team_roster_view (0003_views.sql). xp_ledger has no
-- insert/update/delete policy for any role at all — it is written
-- exclusively by SECURITY DEFINER functions (0004_functions.sql).

alter table profiles enable row level security;
alter table athletes enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table daily_check_ins enable row level security;
alter table combine_tests enable row level security;
alter table combine_checkpoints enable row level security;
alter table attribute_points_ledger enable row level security;
alter table quests enable row level security;
alter table quest_completions enable row level security;
alter table rewards enable row level security;
alter table reward_claims enable row level security;
alter table gear_items enable row level security;
alter table gear_inventory enable row level security;
alter table gear_equipped enable row level security;
alter table gear_purchases enable row level security;
alter table team_programs enable row level security;
alter table team_program_opt_ins enable row level security;
alter table xp_ledger enable row level security;

-- profiles: user can see/edit only their own row.
create policy profiles_self_select on profiles for select using (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid());
create policy profiles_self_insert on profiles for insert with check (id = auth.uid());

-- athletes: parent-only, full CRUD on their own athletes. No coach SELECT
-- policy exists at all — this is the deliberate narrowing chosen over the
-- change-request doc's literal "coach can read roster athlete rows" wording.
create policy athletes_parent_all on athletes for all
  using (parent_profile_id = auth.uid())
  with check (parent_profile_id = auth.uid());

-- teams / leagues: readable by any authenticated user (no athlete PII in
-- these rows — name/join_code/owner id only). Writes are owner-scoped.
create policy teams_select_authenticated on teams for select using (auth.role() = 'authenticated');
create policy teams_coach_write on teams for insert with check (coach_profile_id = auth.uid());
create policy teams_coach_update on teams for update using (coach_profile_id = auth.uid());

create policy leagues_select_authenticated on leagues for select using (auth.role() = 'authenticated');
create policy leagues_owner_write on leagues for insert with check (owner_profile_id = auth.uid());
create policy leagues_owner_update on leagues for update using (owner_profile_id = auth.uid());

create policy league_members_select on league_members for select using (auth.role() = 'authenticated');
-- No insert policy — league_members is only ever written by the join_league() RPC.

-- team_members: a parent can see/insert requests for their own athletes;
-- a coach can see/decide requests for their own team.
create policy team_members_parent_select on team_members for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);
create policy team_members_coach_select on team_members for select using (
  team_id in (select id from teams where coach_profile_id = auth.uid())
);
create policy team_members_parent_insert on team_members for insert with check (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
  and status = 'pending'
);
create policy team_members_coach_decide on team_members for update using (
  team_id in (select id from teams where coach_profile_id = auth.uid())
);

-- daily_check_ins: parent-only, full CRUD scoped through athlete ownership.
-- (Daily check-in is the one write path that stays direct client insert —
-- it's ungated/frictionless in the current app and has no PIN requirement.)
create policy daily_parent_all on daily_check_ins for all
  using (athlete_id in (select id from athletes where parent_profile_id = auth.uid()))
  with check (athlete_id in (select id from athletes where parent_profile_id = auth.uid()));

-- combine_tests: parent can select and insert as 'pending' only. There is
-- NO update policy at all — verifying, flipping status, and editing
-- coach_grades are exclusively done through verify_combine_test() /
-- update_coach_grades() (0004_functions.sql), because verification is what
-- triggers an xp_ledger insert and must not be a bare client-side toggle.
create policy combine_parent_select on combine_tests for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);
create policy combine_parent_insert on combine_tests for insert with check (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
  and status = 'pending'
);

create policy checkpoints_parent_select on combine_checkpoints for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);
create policy attrpoints_parent_select on attribute_points_ledger for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);
-- attribute_points_ledger insert happens only via log_daily_check_in() so it
-- never drifts out of sync with the daily_check_ins row that produced it.

-- quests / rewards / gear_items: static catalogs, world-readable, no client writes.
create policy quests_select_all on quests for select using (true);
create policy rewards_select_all on rewards for select using (true);
create policy gear_items_select_all on gear_items for select using (true);

-- quest_completions / reward_claims / gear_purchases: parent-only SELECT.
-- No INSERT policy on any of these — each one carries an xp_ledger side
-- effect and is written exclusively by its corresponding RPC.
create policy quest_completions_parent_select on quest_completions for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);
create policy reward_claims_parent_select on reward_claims for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);
create policy gear_purchases_parent_select on gear_purchases for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);

-- gear_inventory: parent-only SELECT (rows are written by buy_gear_item()/
-- complete_daily_mission() RPCs, not direct insert).
create policy gear_inventory_parent_select on gear_inventory for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);
-- gear_equipped: equipping (not purchasing) is a free, non-XP action today,
-- so it stays direct client read/write, unlike purchase which is RPC-only.
create policy gear_equipped_parent_all on gear_equipped for all using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
) with check (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);

-- team_programs: coach on the team can write; approved-roster athletes'
-- parents (plus the coach, via the write policy's using-clause) can read.
create policy team_programs_coach_write on team_programs for all using (
  team_id in (select id from teams where coach_profile_id = auth.uid())
) with check (
  team_id in (select id from teams where coach_profile_id = auth.uid())
);
create policy team_programs_roster_select on team_programs for select using (
  team_id in (
    select tm.team_id from team_members tm
    join athletes a on a.id = tm.athlete_id
    where tm.status = 'approved' and a.parent_profile_id = auth.uid()
  )
);

create policy team_program_optin_parent_all on team_program_opt_ins for all using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
) with check (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);

-- xp_ledger: SELECT only, parent-scoped. No insert/update/delete policy for
-- any role — this table is written exclusively by SECURITY DEFINER
-- functions (0004_functions.sql). Coach aggregate access to XP happens
-- through team_roster_view/team_xp_totals (0003_views.sql), never this
-- table directly.
create policy xp_ledger_parent_select on xp_ledger for select using (
  athlete_id in (select id from athletes where parent_profile_id = auth.uid())
);
