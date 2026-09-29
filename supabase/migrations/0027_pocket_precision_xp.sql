-- Level Up Athletics — add Pocket Precision to the arcade XP allowlist.
--
-- award_arcade_xp() (0017_arcade_game_xp_server_side.sql, previously
-- widened for Cannon Arm in 0023, Dugout Disaster in 0024, Ballpark
-- Breakout in 0025, and Skyline Slam in 0026) whitelists valid game ids
-- server-side so a tampered client call can't award XP under a made-up
-- game name. Pocket Precision is a new 8th arcade mini-game (embedded
-- the same iframe way as the others, using the same same-origin
-- window.onLevelUpGameComplete callback contract as Ballpark
-- Breakout/Skyline Slam — see handlePocketPrecisionResult in app.js) so
-- it needs to be added to that allowlist. Everything else about the
-- function (the 25/day cross-game cap, the 0-25 per-request ceiling) is
-- unchanged.
create or replace function award_arcade_xp(p_athlete_id uuid, p_game_id text, p_xp int)
returns int language plpgsql security definer set search_path = public as $$
declare v_today_total int; v_award int;
begin
  if not exists (select 1 from athletes where athletes.id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if p_game_id not in ('homeRunHero','webGem','clutchCatch','strikeZone','cannonArm','dugoutDisaster','ballparkBreakout','skylineSlam','pocketPrecision') then
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
