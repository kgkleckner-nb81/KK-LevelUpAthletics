-- Level Up Athletics — sport tag.
--
-- An athlete and a team can each say which sport(s) they play, for example
-- {baseball} or {basketball,baseball}. NULL means "all sports", which is how
-- everything behaves today. The page uses it only to decide what to feature
-- first (quests, trivia, missions, arcade, starter look); nothing is hidden
-- and XP, ratings and leaderboards are the same for every sport.
--
-- The database only guarantees the value is 1 to 5 short lowercase words, so
-- new sports never need a database change. Parents already update their own
-- athletes, and coaches their own teams, under the existing row security.
alter table athletes add column if not exists sports text[];
alter table teams add column if not exists sports text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'athletes_sports_shape') then
    alter table athletes add constraint athletes_sports_shape
      check (sports is null
             or (cardinality(sports) between 1 and 5
                 and array_position(sports, null) is null
                 and array_to_string(sports, ',') ~ '^[a-z]{2,20}(,[a-z]{2,20})*$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_sports_shape') then
    alter table teams add constraint teams_sports_shape
      check (sports is null
             or (cardinality(sports) between 1 and 5
                 and array_position(sports, null) is null
                 and array_to_string(sports, ',') ~ '^[a-z]{2,20}(,[a-z]{2,20})*$'));
  end if;
end $$;
