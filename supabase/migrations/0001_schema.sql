-- Level Up Athletics — Phase A: core schema
-- Run this first, in order, in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------- Core identity ----------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_parent boolean not null default false,
  is_coach boolean not null default false,
  approval_pin_hash text,
  created_at timestamptz not null default now()
);

create table athletes (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references profiles(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  age_bracket text,
  created_at timestamptz not null default now()
);

-- ---------- Teams / leagues ----------

create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  owner_profile_id uuid not null references profiles(id),
  season text,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  coach_profile_id uuid not null references profiles(id),
  join_code text not null unique,
  league_id uuid references leagues(id),
  logo_url text,
  created_at timestamptz not null default now()
);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  status text not null check (status in ('pending','approved','declined')) default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id),
  unique(team_id, athlete_id)
);

create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(league_id, team_id)
);
-- A team belongs to at most one league (mirrors teams.league_id 1:1).
create unique index one_league_per_team on league_members(team_id);

-- ---------- Daily check-ins ----------

create table daily_check_ins (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  date date not null,
  program_type text not null check (program_type in ('personal','team')),
  program_id text,
  program_name text,
  exercise_data jsonb not null default '{}',
  xp_awarded int not null default 25,
  created_at timestamptz not null default now()
);

-- ---------- Combine tests ----------

create table combine_tests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  week text,
  program_id text,
  program_name text,
  metrics jsonb not null default '{}',       -- raw benchmark values + customCombine[]
  coach_grades jsonb not null default '{}',  -- {strength:8,speed:7,...} keyed by performanceAxisOrder
  status text not null check (status in ('pending','verified')) default 'pending',
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table combine_checkpoints (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  combine_test_id uuid references combine_tests(id),
  overall_rating int not null,
  created_at timestamptz not null default now()
);

create table attribute_points_ledger (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  attribute text not null,   -- 'Strength'|'Speed'|'Quickness'|'Jump'|'Core'|'Balance'|'Coordination'
  points int not null,
  source text,
  checkpoint_id uuid references combine_checkpoints(id), -- null until superseded by next checkpoint
  created_at timestamptz not null default now()
);

-- ---------- Quests ----------

create table quests (
  id text primary key,       -- keep literal ids like the ones in app.js's quests catalog
  name text not null,
  type text not null check (type in ('quest','battle')),
  xp_value int not null
);

create table quest_completions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  quest_id text not null references quests(id),
  approved_by uuid references profiles(id),
  notes text,
  completed_at timestamptz not null default now()
);

-- ---------- Rewards ----------

create table rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  xp_cost int not null,
  tier text not null
);

create table reward_claims (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  reward_id uuid not null references rewards(id),
  approved_by uuid references profiles(id),
  claimed_at timestamptz not null default now()
);

-- ---------- Gear Locker ----------

create table gear_items (
  id text primary key,
  name text not null,
  slot text not null,
  xp_cost int not null,
  tier text not null
);

create table gear_inventory (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  gear_item_id text not null references gear_items(id),
  acquired_via text not null check (acquired_via in ('purchase','mission_reward')),
  created_at timestamptz not null default now(),
  unique(athlete_id, gear_item_id)
);

create table gear_equipped (
  athlete_id uuid primary key references athletes(id) on delete cascade,
  frame text not null default 'default',
  background text not null default 'default',
  outfit text not null default 'default',
  prop text not null default 'default',
  face_accent text not null default 'default',
  title text not null default 'default'
);

create table gear_purchases (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  gear_item_id text not null references gear_items(id),
  xp_cost int not null,
  created_at timestamptz not null default now()
);

-- ---------- Team Program ----------

create table team_programs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  title text not null,
  activity_names text[] not null,
  instructions text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table team_program_opt_ins (
  team_program_id uuid not null references team_programs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  opted_in_at timestamptz not null default now(),
  primary key (team_program_id, athlete_id)
);

-- ---------- XP ledger ----------

create table xp_ledger (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  source text not null,   -- 'daily_check_in'|'combine_verified'|'quest'|'bonus'|'spin'|'mission'|'team_program_bonus'
  amount int not null,
  note text,
  ref_id uuid,             -- id of the row that caused this entry, for idempotency
  created_at timestamptz not null default now()
);
create index xp_ledger_athlete_idx on xp_ledger(athlete_id);
create unique index xp_ledger_idempotency on xp_ledger(source, ref_id) where ref_id is not null;
