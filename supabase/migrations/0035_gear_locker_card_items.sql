-- Level Up Athletics — Gear Locker items for the Avatar Builder.
--
-- Backgrounds, card frames, poses and eyewear from the Avatar Builder become
-- Gear Locker items. Some are free for everyone ("starter" items, is_free =
-- true, never stored in gear_inventory). The rest are locked until bought with
-- XP through the existing buy_gear_item(), exactly like other gear.
--
-- Safeguards in this migration:
--   * the daily mystery reward never hands out card items or free items;
--   * a free item cannot be bought;
--   * a saved look that uses an item the athlete does not own is refused by the
--     database itself (not only by the page);
--   * anything an athlete already built, and anything they bought of the old
--     border and background gear, is kept: they get the matching card items.
-- Nothing is dropped. Existing gear rows and purchases are untouched.

-- ---------- catalog ----------
alter table gear_items add column if not exists is_free boolean not null default false;

-- Item ids are 'kit-' + kind + '-' + the builder's option id, e.g. kit-bg-stadium.
-- Prices follow the usual ladder: Common 75, Uncommon 150, Rare 250, Legendary 400.
insert into gear_items (id, name, slot, xp_cost, tier, tintable, is_free) values
  -- card backgrounds
  ('kit-bg-sandlot',    'Sandlot Background',       'kit_background', 0,   'Common',    false, true),
  ('kit-bg-daygame',    'Day Game Background',      'kit_background', 0,   'Common',    false, true),
  ('kit-bg-stadium',    'Baseball Stadium Background','kit_background', 150, 'Uncommon',  false, false),
  ('kit-bg-football',   'Football Stadium Background','kit_background', 150, 'Uncommon',  false, false),
  ('kit-bg-concert',    'Arena Concert Background', 'kit_background', 250, 'Rare',      false, false),
  ('kit-bg-laser',      'Laser Arena Background',   'kit_background', 250, 'Rare',      false, false),
  ('kit-bg-lava',       'Hot Lava Background',      'kit_background', 400, 'Legendary', false, false),
  -- card frames
  ('kit-frame-sandlot',   'Sandlot Frame',         'kit_frame',      0,   'Common',    false, true),
  ('kit-frame-retro',     'Retro All-Star Frame',    'kit_frame',      75,  'Common',    false, false),
  ('kit-frame-platinum',  'Platinum Frame',        'kit_frame',      150, 'Uncommon',  false, false),
  ('kit-frame-gold',      'Gold Frame',            'kit_frame',      150, 'Uncommon',  false, false),
  ('kit-frame-charged',   'Charged Chrome Frame',  'kit_frame',      250, 'Rare',      false, false),
  ('kit-frame-backstage', 'Backstage Voltage Frame','kit_frame',      250, 'Rare',      false, false),
  ('kit-frame-wood',      'Woodgrain Frame',        'kit_frame',      250, 'Rare',      false, false),
  ('kit-frame-signature', 'Signature Frame',        'kit_frame',      250, 'Rare',      false, false),
  ('kit-frame-pennant',   'Pennant Frame',          'kit_frame',      250, 'Rare',      false, false),
  ('kit-frame-magma',     'Magma Forge Frame',     'kit_frame',      400, 'Legendary', false, false),
  ('kit-frame-foil',      'Heirloom Foil Frame',   'kit_frame',      400, 'Legendary', false, false),
  -- poses
  ('kit-pose-ready',    'Ready Stance',            'kit_pose',       0,   'Common',    false, true),
  ('kit-pose-hips',     'Hands on Hips',           'kit_pose',       75,  'Common',    false, false),
  -- eyewear
  ('kit-eyewear-neon',  'Neon Shield Glasses',     'kit_eyewear',    150, 'Uncommon',  false, false)
on conflict (id) do update set
  name = excluded.name, slot = excluded.slot, xp_cost = excluded.xp_cost,
  tier = excluded.tier, tintable = excluded.tintable, is_free = excluded.is_free;

-- ---------- daily mystery reward: leave card items and free items out ----------
-- Same function as 0004 with one extra filter. Card items are not part of the
-- mystery pool (that is a separate decision); free items would be wasted drops.
create or replace function complete_daily_mission(p_athlete_id uuid, p_mission_title text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_already boolean; v_unowned text[]; v_item_id text; v_result jsonb;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  select exists(select 1 from xp_ledger where athlete_id=p_athlete_id and source='mission' and created_at::date = current_date) into v_already;
  if v_already then raise exception 'mission already complete today'; end if;
  select array_agg(gi.id) into v_unowned from gear_items gi
    where gi.id not in (select inv.gear_item_id from gear_inventory inv where inv.athlete_id = p_athlete_id)
      and not gi.is_free
      and gi.slot not like 'kit\_%' escape '\';
  if v_unowned is not null and array_length(v_unowned,1) > 0 and random() < 0.5 then
    v_item_id := v_unowned[1 + floor(random() * array_length(v_unowned,1))::int];
    insert into gear_inventory(athlete_id, gear_item_id, acquired_via) values (p_athlete_id, v_item_id, 'mission_reward');
    v_result := jsonb_build_object('type','item','item_id', v_item_id);
  else
    insert into xp_ledger(athlete_id, source, amount, note) values (p_athlete_id, 'mission', 40, p_mission_title);
    v_result := jsonb_build_object('type','xp','xp',40);
  end if;
  return v_result;
end $$;

-- ---------- buying: free items are included, not for sale ----------
-- Same function as 0009 plus the free check.
create or replace function buy_gear_item(p_athlete_id uuid, p_gear_item_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_cost int; v_balance int; v_free boolean;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if exists (select 1 from gear_inventory where athlete_id = p_athlete_id and gear_item_id = p_gear_item_id) then
    raise exception 'already owned';
  end if;
  select xp_cost, is_free into v_cost, v_free from gear_items where id = p_gear_item_id;
  if v_free then raise exception 'item is included for free'; end if;
  select coalesce(total_xp,0)
    - (select coalesce(sum(r.xp_cost),0) from reward_claims rc join rewards r on r.id = rc.reward_id where rc.athlete_id = p_athlete_id)
    - (select coalesce(sum(xp_cost),0) from gear_purchases where athlete_id = p_athlete_id)
    into v_balance from athlete_xp_totals where athlete_id = p_athlete_id;
  if v_balance < v_cost then raise exception 'insufficient balance'; end if;
  insert into gear_inventory(athlete_id, gear_item_id, acquired_via) values (p_athlete_id, p_gear_item_id, 'purchase');
  insert into gear_purchases(athlete_id, gear_item_id, xp_cost) values (p_athlete_id, p_gear_item_id, v_cost);
end $$;

-- ---------- a saved look may only use items the athlete owns ----------
-- Free items always pass. Looks written without a signed-in user (the SQL
-- editor, service role) are not checked. Option ids this function does not
-- know are ignored, because the page falls back to its default for them.
create or replace function athletes_check_avatar_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bad text;
begin
  if auth.uid() is null then return new; end if;
  if new.avatar_config is null then return new; end if;
  if tg_op = 'UPDATE' and new.avatar_config is not distinct from old.avatar_config then return new; end if;
  select gi.id into v_bad
  from (values
    ('kit-bg-'    || (new.avatar_config ->> 'bg')),
    ('kit-frame-' || (new.avatar_config ->> 'frame')),
    ('kit-pose-'  || (new.avatar_config ->> 'pose')),
    (case when new.avatar_config ->> 'glasses' = 'true' then 'kit-eyewear-neon' end)
  ) as w(item_id)
  join gear_items gi on gi.id = w.item_id
  where not gi.is_free
    and not exists (
      select 1 from gear_inventory inv
      where inv.athlete_id = new.id and inv.gear_item_id = gi.id
    )
  limit 1;
  if v_bad is not null then
    raise exception 'locked item: %', v_bad using errcode = '42501';
  end if;
  return new;
end $$;

create or replace trigger athletes_avatar_items_check
  before insert or update of avatar_config on athletes
  for each row execute function athletes_check_avatar_items();

-- ---------- keep what players already have ----------
-- 1) Every card item used by a look an athlete already saved is theirs.
insert into gear_inventory (athlete_id, gear_item_id, acquired_via)
select distinct a.id, gi.id, 'mission_reward'
from athletes a
cross join lateral (values
  ('kit-bg-'    || (a.avatar_config ->> 'bg')),
  ('kit-frame-' || (a.avatar_config ->> 'frame')),
  ('kit-pose-'  || (a.avatar_config ->> 'pose')),
  (case when a.avatar_config ->> 'glasses' = 'true' then 'kit-eyewear-neon' end)
) as w(item_id)
join gear_items gi on gi.id = w.item_id
where a.avatar_config is not null and not gi.is_free
on conflict (athlete_id, gear_item_id) do nothing;

-- 2) Players who bought the old border and background gear get the closest card
--    item of the same tier (or the nearest paid tier up where none is paid).
--    The old items stay in their locker; this only adds. No XP changes.
insert into gear_inventory (athlete_id, gear_item_id, acquired_via)
select distinct inv.athlete_id, m.kit_id, 'mission_reward'
from gear_inventory inv
join (values
  ('border-rookie',     'kit-frame-retro'),
  ('border-starter',    'kit-frame-platinum'),
  ('fire-frame',        'kit-frame-charged'),
  ('diamond-frame',     'kit-frame-foil'),
  ('blueprint-bg',      'kit-bg-stadium'),
  ('stadium-lights-bg', 'kit-bg-stadium'),
  ('bg-sunset',         'kit-bg-football'),
  ('bg-outer-space',    'kit-bg-laser'),
  ('bg-volcano',        'kit-bg-lava')
) as m(legacy_id, kit_id) on m.legacy_id = inv.gear_item_id
on conflict (athlete_id, gear_item_id) do nothing;
