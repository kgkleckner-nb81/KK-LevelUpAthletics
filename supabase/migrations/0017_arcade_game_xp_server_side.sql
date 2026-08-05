-- Level Up Athletics — Arcade mini-game XP becomes real, server-tracked XP.
--
-- Same gap award_spin_xp (0008_spin_xp_server_side.sql) closed for the
-- Prize Wheel: Arcade was explicitly out of scope for the schema during
-- the Supabase migration, so the four mini-games (Home Run Hero, Web Gem,
-- Clutch Catch, Strike Zone Challenge) were left writing only to
-- state.gameXP, a localStorage field capped at 25 XP/day — never counted
-- in Career XP (xp() / state.totalXP / xp_ledger), and trivially
-- bypassable by editing local state directly since the cap was
-- client-side-only. Spin got its follow-up in round 8; this is the games'
-- follow-up.
--
-- Deliberately unchanged: state.arcadeScores/state.arcadeMetrics (personal
-- bests, Player Card metric mapping) stay local-only — this only moves
-- where AWARDED XP is recorded, not score tracking.
--
-- Unlike spin's exact-value whitelist, game XP is a computed/variable
-- amount (streak length, contact tier, catch score) so an exact whitelist
-- isn't possible — a 0-25 range check (each game's own client-side ceiling
-- already caps at 25 or well under) plus the daily cross-game cap below is
-- the guardrail instead.
create or replace function award_arcade_xp(p_athlete_id uuid, p_game_id text, p_xp int)
returns int language plpgsql security definer set search_path = public as $$
declare v_today_total int; v_award int;
begin
  if not exists (select 1 from athletes where athletes.id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if p_game_id not in ('homeRunHero','webGem','clutchCatch','strikeZone') then
    raise exception 'invalid game id';
  end if;
  if p_xp is null or p_xp < 0 or p_xp > 25 then
    raise exception 'invalid xp amount';
  end if;

  select coalesce(sum(amount),0) into v_today_total from xp_ledger
    where athlete_id = p_athlete_id and source = 'arcade_game' and created_at::date = now()::date;

  -- Partial credit up to the remaining daily allowance, same behavior
  -- awardGameXP() already had locally (Math.min(avail, amount)).
  v_award := greatest(0, least(p_xp, 25 - v_today_total));

  if v_award > 0 then
    insert into xp_ledger(athlete_id, source, amount, note) values (p_athlete_id, 'arcade_game', v_award, p_game_id);
  end if;

  return v_award;
end $$;

revoke all on function award_arcade_xp(uuid, text, int) from public;
grant execute on function award_arcade_xp(uuid, text, int) to authenticated;
