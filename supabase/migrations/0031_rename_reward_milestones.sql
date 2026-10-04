-- Level Up Athletics — rename the seven Reward Center milestones to match
-- the new dimensional artwork and copy (LUA Reward Milestones v3).
--
-- Display names only. rewards.id is the foreign key in reward_claims, so
-- every past claim stays attached to its reward and the Claimed history
-- (which reads rewards.name through that join) relabels automatically.
-- xp_cost and tier are unchanged. The app finds a reward by name when
-- claiming (findRewardIdByTitle), so run this at the same time the site
-- update goes live.
update rewards set name = 'Victory Treat'       where name = 'Ice Cream Single';
update rewards set name = 'Bonus Round'         where name = 'Batting Cage Trip';
update rewards set name = 'Gear Grab'           where name = 'New Baseball Bonus';
update rewards set name = 'Gear Store Draft'    where name = 'Baseball Store Visit';
update rewards set name = 'Fan Favorite'        where name = '"The Show" Award';
update rewards set name = 'All-Star Adventure'  where name = 'All-Star Outing';
update rewards set name = 'MVP Experience'      where name = 'MVP Surprise';
