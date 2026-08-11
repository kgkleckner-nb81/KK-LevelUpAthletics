-- Level Up Athletics — Gear Locker v2: full slot taxonomy + placeholder art.
--
-- The original Gear Locker (0001_schema.sql's gear_items/gear_equipped,
-- round 12) shipped as buy/equip mechanics only — no actual visual
-- rendering was ever built (confirmed: no gear art files exist anywhere in
-- assets/, and no compositing function exists in app.js). That's why the
-- Gear Locker card has been sitting behind an "Under Construction" overlay.
--
-- This migration expands the slot taxonomy to match
-- design-reference/player-card-avatar-attributes.md and the locked v1 item
-- list, and adds color-tint support for a few slots (jersey/headwear/face
-- paint), so a single art asset can support many colors instead of one PNG
-- per color. Art itself is still placeholder (CSS-rendered, no image
-- files) — the schema and columns here don't change when real art is
-- swapped in later.

-- ---------- gear_equipped: rename existing columns, add new slots ----------
-- Renaming (not dropping) preserves any athlete's already-equipped values.
alter table gear_equipped rename column frame to border;
alter table gear_equipped rename column outfit to jersey;
alter table gear_equipped rename column prop to gear;
alter table gear_equipped rename column face_accent to face_extra;

alter table gear_equipped add column if not exists base text not null default 'default';
alter table gear_equipped add column if not exists headwear text not null default 'default';
alter table gear_equipped add column if not exists hair text not null default 'default';
alter table gear_equipped add column if not exists skin text not null default 'default';
alter table gear_equipped add column if not exists badge text not null default 'default';

-- Per-slot color choices for tintable items, e.g. {"jersey":"#1F7AE0"}.
-- Only meaningful for slots whose equipped gear_items row has
-- tintable = true (see below) — the client is responsible for only
-- offering a color picker on those slots.
alter table gear_equipped add column if not exists colors jsonb not null default '{}';

-- The old "title" slot (single item: captain-title) is folded into the new
-- "badge" slot — carry forward anyone who already had it equipped before
-- dropping the column. Keeps the existing item id as-is (see below) rather
-- than renaming it, since renaming a gear_items primary key referenced by
-- gear_inventory/gear_purchases would fail if any athlete already owns it.
update gear_equipped set badge = 'captain-title' where title = 'captain-title';
alter table gear_equipped drop column if exists title;

-- ---------- gear_items: tintable flag + updated slot values ----------
alter table gear_items add column if not exists tintable boolean not null default false;

-- Remap existing catalog rows' slot values to the new taxonomy so Table
-- Editor stays legible even though nothing reads this table live (the
-- catalog is still the hardcoded lockerItems array in app.js, matching
-- how quests/rewards already work — a deliberate choice, not an oversight).
update gear_items set slot = 'border' where slot = 'frame';
update gear_items set slot = 'jersey' where slot = 'outfit';
update gear_items set slot = 'gear' where slot = 'prop';
update gear_items set slot = 'faceExtra' where slot = 'faceAccent';
update gear_items set slot = 'badge' where id = 'captain-title';

-- ---------- v1 catalog seed ----------
-- Mirrors app.js's lockerItems array exactly (see gear-locker-v2 branch).
-- Safe to re-run: on conflict just refreshes name/cost/tier/tintable in
-- case the catalog changes later.
insert into gear_items (id, name, slot, xp_cost, tier, tintable) values
  -- base
  ('beast-mode-base',      'Beast Mode',                'base',      150,  'Uncommon',  false),
  ('giant-head-base',      'Giant Head',                'base',      250,  'Rare',      false),
  -- jersey (pinstripe-kit already exists, retagged to this slot above —
  -- reused here, not duplicated, just refreshing its name/cost/tier)
  ('jersey-standard-color','Standard Jersey',           'jersey',    75,   'Common',    true),
  ('pinstripe-kit',        'Pinstripe Jersey',          'jersey',    75,   'Common',    false),
  ('jersey-cutoff',        'Cut-Off Sleeves',           'jersey',    150,  'Uncommon',  false),
  ('jersey-hype',          'Hype Jersey',                'jersey',    250,  'Rare',      false),
  -- headwear
  ('headwear-batting-helmet','Batting Helmet',          'headwear',  75,   'Common',    false),
  ('headwear-classic-cap', 'Classic Cap',                'headwear',  75,   'Common',    true),
  ('headwear-visor',       'Visor',                      'headwear',  150,  'Uncommon',  false),
  ('headwear-bandana',     'Bandana',                    'headwear',  150,  'Uncommon',  false),
  ('headwear-cheesehead',  'Cheesehead Hat',             'headwear',  400,  'Legendary', false),
  -- hair
  ('hair-mullet',          'Mullet',                     'hair',      75,   'Common',    false),
  ('hair-giant-afro',      'Giant Afro',                 'hair',      150,  'Uncommon',  false),
  ('hair-mohawk',          'Mohawk',                     'hair',      150,  'Uncommon',  false),
  ('hair-rainbow-wig',     'Rainbow Wig',                'hair',      250,  'Rare',      false),
  -- faceExtra
  ('face-paint',           'Face Paint',                 'faceExtra', 75,   'Common',    true),
  ('face-mustache',        'Handlebar Mustache',         'faceExtra', 75,   'Common',    false),
  ('face-gold-grill',      'Gold Grill',                 'faceExtra', 250,  'Rare',      false),
  -- gear (eye-black, grip-tape already exist, retagged to this slot above —
  -- reused here, not duplicated)
  ('gear-bat',              'Bat',                        'gear',      75,   'Common',    false),
  ('gear-glove',            'Glove',                      'gear',      75,   'Common',    false),
  ('eye-black',              'Lightning Eye Black',        'gear',      75,   'Common',    false),
  ('gear-shades-wrap',      'Wrap-Around Shades',         'gear',      75,   'Common',    false),
  ('grip-tape',              'Grip Tape',                  'gear',      150,  'Uncommon',  false),
  ('gear-shades-flip',      'Flip-Up Shades',             'gear',      150,  'Uncommon',  false),
  ('gear-shades-silly',     'Silly Shades',                'gear',      250,  'Rare',      false),
  ('gear-banana',           'Banana',                      'gear',      400,  'Legendary', false),
  -- accessory
  ('accessory-bling',       'Bling Chain',                 'accessory', 150,  'Uncommon',  false),
  ('accessory-cape',        'Cape',                        'accessory', 250,  'Rare',      false),
  -- border
  ('border-rookie',         'Rookie Border',               'border',    75,   'Common',    false),
  ('border-starter',        'Starter Border',              'border',    150,  'Uncommon',  false),
  ('fire-frame',            'All-Star Border',             'border',    250,  'Rare',      false),
  ('diamond-frame',         'Legendary Holographic Border', 'border',   400,  'Legendary', false),
  -- background
  ('blueprint-bg',          'Blueprint Card Background',   'background',75,   'Common',    false),
  ('stadium-lights-bg',     'Stadium Lights Background',   'background',150,  'Uncommon',  false),
  ('bg-sunset',             'Sunset Game Day',             'background',150,  'Uncommon',  false),
  ('bg-outer-space',        'Outer Space',                 'background',250,  'Rare',      false),
  ('bg-volcano',            'Volcano / Lava Field',        'background',400,  'Legendary', false),
  -- skin (full head override)
  ('skin-mascot',           'Team Mascot',                 'skin',      250,  'Rare',      false),
  ('skin-shark',             'Shark',                       'skin',      250,  'Rare',      false),
  ('skin-trex',              'T. Rex',                      'skin',      400,  'Legendary', false),
  ('skin-banana-costume',    'Banana Costume',              'skin',      400,  'Legendary', false),
  -- badge
  ('badge-first-pitch',      'First Pitch',                 'badge',     75,   'Common',    false),
  ('badge-diamond-grinder',  'Diamond Grinder',             'badge',     150,  'Uncommon',  false),
  ('badge-streak-king',      'Streak King/Queen',           'badge',     150,  'Uncommon',  false),
  ('badge-clutch-gene',      'Clutch Gene',                 'badge',     250,  'Rare',      false),
  ('badge-most-improved',    'Most Improved',               'badge',     250,  'Rare',      false),
  ('captain-title',          'Team Captain',                'badge',     250,  'Rare',      false),
  ('badge-the-show',         'The Show',                    'badge',     400,  'Legendary', false)
on conflict (id) do update set
  name = excluded.name, slot = excluded.slot, xp_cost = excluded.xp_cost,
  tier = excluded.tier, tintable = excluded.tintable;
