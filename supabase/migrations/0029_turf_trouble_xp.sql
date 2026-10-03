-- Level Up Athletics — add Turf Trouble to the arcade XP allowlist.
--
-- award_arcade_xp() (0017_arcade_game_xp_server_side.sql, widened for new
-- games in 0023-0027) whitelists valid game ids server-side so a tampered
-- client call can't award XP under a made-up game name. Turf Trouble is a
-- new arcade mini-game (embedded the same iframe way as the others, using
-- the same-origin window.onLevelUpGameComplete contract — see
-- handleTurfTroubleResult in app.js) so it needs to be added to that
-- allowlist. Everything else (the 25/day cross-game cap, the 0-25
-- per-request ceiling) is unchanged.
--
-- The allowlist below is the live list after the Web Gem / Strike Zone /
-- Clutch Catch removal: those three ids are intentionally KEPT here
-- (harmless, and past xp_ledger rows reference them), so nothing that
-- worked before stops working.
create or replace function award_arcade_xp(p_athlete_id uuid, p_game_id text, p_xp int)
returns int language plpgsql security definer set search_path = public as $$
declare v_today_total int; v_award int;
begin
  if not exists (select 1 from athletes where athletes.id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if p_game_id not in ('homeRunHero','webGem','clutchCatch','strikeZone','cannonArm','dugoutDisaster','ballparkBreakout','skylineSlam','pocketPrecision','turfTrouble') then
    raise exception 'invalid game id';
  end if;
  if p_xp is null or p_xp < 0 or p_xp > 25 then
    raise exception 'invalid xp amount';
  end if;

  select coalesce(sum(amount),0) into v_today_total from xp_ledger
    where athlete_id = p_athlete_id and source = 'arcade_game' and created_at::date = now()::date;

  -- Partial credit up to the remaining daily allowance.
  v_award := greatest(0, least(p_xp, 25 - v_today_total));

  if v_award > 0 then
    insert into xp_ledger(athlete_id, source, amount, note) values (p_athlete_id, 'arcade_game', v_award, p_game_id);
  end if;

  return v_award;
end $$;

revoke all on function award_arcade_xp(uuid, text, int) from public;
grant execute on function award_arcade_xp(uuid, text, int) to authenticated;
