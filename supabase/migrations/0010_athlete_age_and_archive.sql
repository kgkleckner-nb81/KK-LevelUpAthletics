-- Level Up Athletics — athlete age field + remove-athlete (soft delete).
--
-- age: plain integer, set at creation and editable anytime from the Player
-- Card. Separate from the pre-existing unused age_bracket column (that one
-- was scaffolded in Phase A for a team-division concept like "9U" that
-- never got built — left alone, not repurposed here).
--
-- archived_at: soft delete. A hard delete would cascade away years of
-- workout/combine/quest/reward history with no undo — archiving just hides
-- the athlete from the switcher (listAthletes filters WHERE archived_at IS
-- NULL) while keeping every row intact and reversible.
alter table athletes add column if not exists age int;
alter table athletes add column if not exists archived_at timestamptz;

-- PIN-gated (same tier as Team Setup edits) since it's a consequential,
-- if reversible, account-management action — unlike creating an athlete or
-- editing its age, which stay frictionless.
create or replace function archive_athlete(p_athlete_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  update athletes set archived_at = now()
    where athletes.id = p_athlete_id and parent_profile_id = auth.uid();
  if not found then raise exception 'not authorized or athlete not found'; end if;
end $$;

revoke all on function archive_athlete(uuid, text) from public;
grant execute on function archive_athlete(uuid, text) to authenticated;
