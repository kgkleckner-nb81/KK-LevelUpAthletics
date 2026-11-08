-- Level Up Athletics — daily mission pays XP only.
--
-- The older gear is "coming soon" and not tied to the avatar yet, so a mystery
-- item from the daily mission would be something the player cannot use. Until
-- that gear launches, every completed mission awards 40 XP. Same function, same
-- return shape, same once-a-day rule; only the random item roll is removed.
-- To bring mystery drops back later, restore the roll from 0035.
create or replace function complete_daily_mission(p_athlete_id uuid, p_mission_title text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_already boolean;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  select exists(select 1 from xp_ledger where athlete_id=p_athlete_id and source='mission' and created_at::date = current_date) into v_already;
  if v_already then raise exception 'mission already complete today'; end if;
  insert into xp_ledger(athlete_id, source, amount, note) values (p_athlete_id, 'mission', 40, p_mission_title);
  return jsonb_build_object('type','xp','xp',40);
end $$;
