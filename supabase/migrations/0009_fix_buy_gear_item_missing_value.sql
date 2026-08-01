-- Fix "INSERT has more target columns than expressions" when buying gear.
--
-- buy_gear_item()'s gear_purchases insert listed 3 target columns
-- (athlete_id, gear_item_id, xp_cost) but only supplied 2 values,
-- missing p_gear_item_id entirely.

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
