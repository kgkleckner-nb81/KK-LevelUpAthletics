-- Level Up Athletics — coach approval gate.
--
-- Today, checking "I'm a coach" at signup sets profiles.is_coach = true,
-- and the teams_coach_write RLS policy (0002_rls_policies.sql) only checks
-- coach_profile_id = auth.uid() — it never looks at is_coach at all. That
-- makes the checkbox pure UI decoration: any signed-in user could insert a
-- team row directly via the Supabase client regardless of it.
--
-- is_coach stays exactly what it's always meant: "this person has
-- identified themselves as wanting to coach," set at signup. A new,
-- separate column — coach_approved — is the actual gate: false by
-- default, flipped to true only by hand in the Supabase Studio Table
-- Editor (profiles table, coach_approved column) after manual review. No
-- in-app admin screen is built for this on purpose.
alter table profiles add column if not exists coach_approved boolean not null default false;

-- Prevent a client from just setting coach_approved = true on themselves.
-- profiles_self_insert/profiles_self_update (0002_rls_policies.sql) are
-- ROW-level policies — they let a user write their own profile row with no
-- column restriction, so without this, a direct
-- `supabase.from('profiles').update({coach_approved:true})...` call (or a
-- crafted signup insert payload) would defeat the entire point of this
-- migration. Same technique as approval_pin_hash's column lock in
-- 0006_pin_hardening.sql — applied to both insert and update here, since
-- either write path could otherwise set it.
revoke insert (coach_approved) on profiles from authenticated;
revoke update (coach_approved) on profiles from authenticated;

-- The actual gate: creating a team now requires both owning the row being
-- inserted AND having been approved.
drop policy if exists teams_coach_write on teams;
create policy teams_coach_write on teams for insert with check (
  coach_profile_id = auth.uid()
  and exists (select 1 from profiles p where p.id = auth.uid() and p.coach_approved = true)
);

-- No other coach-only policy or function needs the same check added.
-- Every one of them — teams_coach_update, team_programs_coach_write,
-- team_members_coach_select/decide, join_league(), decide_team_join(),
-- get_team_roster(), remove_team_member() — authorizes off
-- `coach_profile_id = auth.uid()` matching an EXISTING teams row, and the
-- policy above is the *only* path in the whole schema that ever sets a
-- team's coach_profile_id to a user's own id. So gating creation alone
-- transitively gates every downstream coach action: nobody can reach any
-- of them without first passing this check to create a team in the first
-- place. (Confirmed by grepping every coach_profile_id reference across
-- supabase/migrations/ — there's no second path that grants coach
-- privilege independent of owning a teams row.)
--
-- One conscious boundary this does NOT cover: revoking coach_approved on
-- someone who already owns a team does not strip their existing team's
-- management rights (teams_coach_update etc. only check ownership). That's
-- a deliberate scope cut to keep this the "simplest possible gate," not an
-- oversight — revisit if revocation-of-an-active-coach ever becomes a real
-- need.
