-- Level Up Athletics — Prize Wheel spin XP becomes real, server-tracked XP.
--
-- Spin XP was left local-only during the Supabase migration (Arcade was
-- explicitly out of scope for the schema). But the client's displayed
-- "Available Balance" always included it (xp() = state.totalXP +
-- spinXP()), while every spend path (claim_reward, buy_gear_item) only
-- checks the real xp_ledger total — so a balance the UI showed as
-- spendable could get rejected as "insufficient balance". Fix: spins now
-- write directly to xp_ledger, same as every other XP source, so the
-- displayed balance always matches what's actually spendable.
--
-- Not PIN-gated — matches the existing frictionless spin flow (no
-- approval step today), same category as buy_gear_item/log_daily_check_in.
create or replace function award_spin_xp(p_athlete_id uuid, p_xp int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from athletes where athletes.id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  -- Whitelist matches wheelSegments in app.js exactly, so a tampered
  -- client call can't award an arbitrary amount.
  if p_xp not in (5,10,15,20,25,50,100,250,1000) then
    raise exception 'invalid spin value';
  end if;
  insert into xp_ledger(athlete_id, source, amount, note) values (p_athlete_id, 'spin', p_xp, 'Prize Wheel Spin');
end $$;

revoke all on function award_spin_xp(uuid, int) from public;
grant execute on function award_spin_xp(uuid, int) to authenticated;
