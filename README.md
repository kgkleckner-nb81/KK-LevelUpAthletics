# Ethan's Baseball HQ — Logo + Parent Gate Version

Adds:
- Northbrook Spartans logo as the local youth baseball / mid-level tier.
- Milwaukee Brewers logo as the aspirational major league tier.
- Call-Up Ladder progression.
- Parent code gate for weekly combine tests.
- Pending/verified combine status.
- Parent Zone to approve pending weekly tests.
- Progress charts and verified combine best-to-date charts.

Default parent code: SPARTAN9

To use:
1. Unzip this package.
2. Open index.html to test locally.
3. Upload the full folder to Netlify Drop, Vercel, or GitHub Pages to publish.
4. On the iPad, open the published URL and use Share > Add to Home Screen.

Data is saved locally in the browser.


## Added in this version
- Restored Quests & Boss Battles as optional anytime challenges.
- Each quest/battle can award bonus XP.
- Parent code is required to approve and award quest/battle XP.
- Quest history records date, challenge, type, XP, and notes.
- Boss Battles can be completed more than once if the parent wants to award repeat bonuses.

Default parent code remains: SPARTAN9


## Added in Reward Vault version
- Reward Vault page.
- Season XP and Lifetime XP display.
- XP Ledger showing where points came from.
- Parent Bonus XP form with parent-code verification.
- Home Run Meter tied directly to reward milestones.
- Reward milestones at 250, 500, 750, 1000, 1500, 2000, and 3000 XP.


## BL101-inspired visual refresh
This package is a visual-only refresh. It does not intentionally change:
- local storage key,
- existing saved data behavior,
- XP calculations,
- parent-code workflow,
- combine verification workflow,
- quest/battle logic,
- Reward Vault logic.

Visual direction is inspired by BL101-style youth baseball lifestyle apparel:
- bold graphic/drop feel,
- streetwear-style condensed typography,
- sticker/card modules,
- cream/black/gold/orange palette,
- technical grid texture,
- playful athletic retail energy.

No BL101 logos, marks, or protected brand assets are included.

MilB call-up ladder update:
- Rookie uses the existing youth baseball / Spartans logo.
- Travel Ball renamed to Single A with the uploaded A logo.
- High School Ace renamed to Double AA with the uploaded AA logo.
- Brewers Prospect renamed to Triple AAA with the uploaded AAA logo.
- Brewers All-Star renamed to THE SHOW with the Brewers logo.
Functionality was not intentionally changed.


## Card-style Call-Up Ladder correction
Updated ladder progression:
1. Rookie — Little League logo
2. Travel Ball — Northbrook Spartans logo
3. Single A — Timber Rattlers logo
4. Double AA — Biloxi Shuckers logo
5. Triple AAA — San Antonio Missions logo
6. THE SHOW — Milwaukee Brewers logo

The ladder now uses collectible baseball-card style tiles rather than true full-bleed crop/cover images. This preserves the full logo artwork for wide/circular marks such as Missions and Brewers while giving the cards a larger, more premium visual presence.

No intentional changes were made to app functionality, XP calculations, storage behavior, parent verification, quests, charts, or rewards.

Workout History v2 update:
- Added Sit Ups and Skater Jumps to Recent Workouts.
- Renamed user-facing Crunches labels to Sit Ups while preserving the existing `crunches` data field.
- Added completed indicator and estimated XP to Recent Workouts.
- Added PR callouts when a workout beats a previous daily personal record.
- Added tap-to-open workout detail view with XP breakdown and PR summary.
- Added Coach’s Report module to the Clubhouse dashboard.


## Team Edition Demo
This local/static demo adds athlete and team landing pages, daily missions, streak protection, mystery-pack cosmetic unlocks, photo/avatar controls, an exercise repository, coach/parent shout-outs, seasonal drops, positive reactions, simulated team/league leaderboards, and three playable mini-games with a 25 XP daily cap. Team and league data are sample/demo data; real shared accounts and leaderboards require a backend.


## Version 3.1 navigation architecture
- New three-path Home screen: Athlete, Team HQ, and Arcade.
- Athlete subnavigation: Clubhouse, Daily Check-In, Player Card, Weekly Combine, Quests & Battles, Progress, Skill Lab, Reward Locker.
- Team HQ subnavigation: Team Dashboard and League HQ.
- Arcade remains a distinct entertainment environment.
- Persistent player status bar shows tier, level, XP, streak, and pack status.
- Existing local storage key and core feature logic are preserved.
