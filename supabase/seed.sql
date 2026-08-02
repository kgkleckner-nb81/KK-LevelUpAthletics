-- Level Up Athletics — Phase A: catalog seed data
-- Run after 0004_functions.sql. Safe to re-run (upserts on primary key).
--
-- These rows mirror the literal catalog arrays currently hardcoded in
-- app.js: `quests` (app.js:10-21), `rewardMilestones` (app.js:27-35), and
-- `lockerItems` (app.js:1255-1264). Catalog IDs are kept identical to the
-- app's existing ids so the data-layer migration can reference them
-- unchanged.

insert into quests (id, name, type, xp_value) values
  ('daily-double',     'Daily Double',           'quest',  40),
  ('gold-glove',       'Gold Glove Drill',        'quest',  35),
  ('base-stealer',     'Base Stealer Bonus',      'quest',  40),
  ('iron-core',        'Iron Core',               'quest',  45),
  ('power-hitter',     'Power Hitter',            'quest',  45),
  ('dad-challenge',    'Dad Challenge',           'quest',  60),
  ('fastball-monster', 'Fastball Monster',        'battle', 100),
  ('base-dragon',      'Base-Stealing Dragon',    'battle', 100),
  ('spartan-trial',    'Spartan Trial',           'battle', 125),
  ('brewers-callup',   'Brewers Call-Up',         'battle', 175)
on conflict (id) do update set name = excluded.name, type = excluded.type, xp_value = excluded.xp_value;

-- rewards.id is a generated uuid in the schema (unlike quests/gear_items,
-- which keep the app's literal string ids), so these are matched on name
-- for idempotent re-runs rather than a fixed id.
insert into rewards (name, xp_cost, tier)
select v.name, v.xp_cost, v.tier
from (values
  ('Ice Cream Single',        250,  'Common'),
  ('Batting Cage Trip',       500,  'Common'),
  ('New Baseball Bonus',      750,  'Uncommon'),
  ('Baseball Store Visit',    1000, 'Uncommon'),
  ('"The Show" Award',        1500, 'Rare'),
  ('All-Star Outing',         2000, 'Rare'),
  ('MVP Surprise',            3000, 'Legendary')
) as v(name, xp_cost, tier)
where not exists (select 1 from rewards r where r.name = v.name);

insert into gear_items (id, name, slot, xp_cost, tier) values
  ('blueprint-bg',      'Blueprint Card Background',  'background', 75,  'Common'),
  ('stadium-lights-bg', 'Stadium Lights Background',  'background', 150, 'Uncommon'),
  ('fire-frame',        'Fire Player Frame',          'frame',      250, 'Rare'),
  ('diamond-frame',     'Diamond Card Border',        'frame',      400, 'Legendary'),
  ('pinstripe-kit',     'Pinstripe Kit',               'outfit',     75,  'Common'),
  ('grip-tape',         'Grip Tape',                   'prop',       150, 'Uncommon'),
  ('eye-black',         'Lightning Eye Black',         'faceAccent', 75,  'Common'),
  ('captain-title',     'Captain Title',               'title',      250, 'Rare')
on conflict (id) do update set name = excluded.name, slot = excluded.slot, xp_cost = excluded.xp_cost, tier = excluded.tier;
