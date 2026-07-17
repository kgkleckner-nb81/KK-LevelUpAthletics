# Level Up Athletics — Change Request, Round 2

**For Claude Code (or any dev agent) working in this repo.** This document organizes Kurt's feedback into one item per line, grouped by the screen it affects, with references to the actual code (element ids, function names, state fields) wherever they're already known. Every item is tagged:

- **[Cosmetic]** — visual/copy only, no data model impact. Low risk, do anytime.
- **[Functional]** — behavior change using data that already exists in `state`. Moderate risk.
- **[Structural]** — changes the *shape* of `state` (new fields, new entities, new relationships). These are the items worth finalizing carefully — they'll directly inform the Supabase schema whenever that migration happens, so get the shape right here rather than twice.

Read the **Open Questions** section near the end before starting — several requests are ambiguous as written and are flagged rather than guessed at.

---

## Context & Positioning

Kurt's reference point: **D1 Training** (d1training.com) — a brick-and-mortar franchise offering coach-led, in-person strength & conditioning for youth (ages 7-18) and adults, structured around certified coaching, technique/injury-prevention, and a paid membership/facility model. It's serious and costly.

Level Up Athletics is intentionally **not** that. It's a "training lite" companion: low/no cost, self-directed with light parent/coach oversight, and — critically — the comparison layer is peer-vs-peer (your team, your friends) rather than athlete-vs-elite-benchmark. Keep this framing in mind for tone and copy throughout: encouraging and social, not clinical or competitive-with-professionals.

**[Cosmetic]** Aesthetics, colors, and typeface are confirmed as final — retain the current creamsicle/neon system exactly as built. No changes requested in this round.

---

## Home Screen (`#home`)

1. **[Cosmetic]** Remove the numbered badges (`01` / `02` / `03`) currently shown on the three path cards (`.path-number` divs inside `.path-card`). Keep the icons/images, headline, and description on each card.
2. **[Functional]** Add a new explainer box on the Home screen describing what XP is and does. Content should cover, in plain language:
   - XP is **earned** by completing training activities (workouts, combine tests).
   - XP is **earned** by playing Arcade games and spinning the bonus wheel.
   - XP is **awarded** by team coaches for good actions.
   - XP is **used** (spent) to claim rewards.
   This should live somewhere visible on the home screen, styled consistent with the existing card system.

---

## Athlete Section Navigation (`#athleteSubnav`)

3. **[Cosmetic]** Reorder the athlete subnav tabs so **Skill Lab** moves to the second position, immediately right of **Clubhouse**. Current order is Clubhouse, Daily Check-In, Player Card, Weekly Combine, Quests & Battles, Progress, Skill Lab, Reward Locker — only Skill Lab's position changes; leave the rest of the sequence as-is.

---

## Clubhouse (`#clubhouse`)

4. **[Cosmetic]** Remove the "LVL 1" indicator. Note: the only "LVL" element in the app is `#statusLevel` inside the **persistent top status bar** (`.status-bar`), which renders on every screen, not just Clubhouse — confirm this is the one meant, since removing it there removes it site-wide. (See Open Questions.)
5. **[Deferred — no action]** Kurt flagged that the rating thresholds which move an athlete between tiers (`tiers` array in `app.js`: Rookie → Travel Ball → Single A → Double AA → Triple AAA → THE SHOW, currently keyed to flat `overall` rating cutoffs) feel loose and will eventually need a more rigorous formula. Explicitly OK to leave as-is for this round — noted for the roadmap, not this pass.

---

## Skill Lab (`#library`)

6. **[Structural]** Remove the current "Pick up to 4 Skill Lab exercises" / training-slots section (`#trainingSlots`, backed by `state.trainingSlots`, a fixed 4-item array). This mechanism is being replaced by the new **named Programs** model described under Daily Check-In below — Skill Lab's role becomes purely browse-and-add-to-a-program, not directly filling fixed slots.
7. **[Cosmetic/Functional]** Retain the training repository/library browsing (`renderExerciseLibrary()`, the "View" button opening `renderActivityDetail()`), including the "How to Perform / Demo Video / How to Track" activity detail view already built. The "Add" action on each activity should now add it to whichever Program the athlete is currently building/editing (see below), instead of to a training slot.

---

## Daily Check-In (`#daily`) — biggest structural item this round

This section replaces the current fixed-fields-plus-4-slots model with a **named, multi-Program** model. This is the single most important data-shape decision in this round — get the shape settled here before it becomes a Supabase table.

8. **[Structural]** Introduce a **Program** entity: `{ id, name, activityIds[] }`. An athlete can create multiple named programs (Kurt's examples: "Baseball Exercise Program," "Strength Program"), each with its own set of Skill Lab activities attached via the Skill Lab "Add" action.
9. **[Functional]** Add a **"Workout Builder"** button/flow for athletes who haven't set up a program yet, or want to build a new one — this should route to Skill Lab in an "adding to program X" mode rather than being a separate builder UI.
10. **[Functional]** Athletes select which saved Program they're logging against for a given day. If only one Program exists, it's selected automatically with no picker shown. If multiple exist, show a picker.
11. **[Cosmetic]** Visually, Daily Check-In should look the same as it does today (card layout, form-grid) — the difference is that the exercises shown are whichever activities belong to the currently-selected Program, rendered the same way the current per-metric unit-aware fields already work (`metricInputHTML()`/`renderDailyCustomFields()` — this logic can largely be reused, just sourced from the selected Program's activity list instead of `state.trainingSlots`).
12. **[Functional]** Change the date field from a typed `<input type="date">` to a calendar-picker interaction if that's not already satisfied by the native date input's calendar affordance in the target browsers — confirm intent (see Open Questions).
13. **[Functional]** Keep 3-4 dropdown slots at the bottom of Daily Check-In for logging an ad hoc exercise outside the athlete's active Program (this already exists conceptually via `allExerciseNames()` + the custom dropdown pattern used in the Weekly Combine form — reuse that pattern here rather than building new).
14. **[Structural]** Add a parallel **Team Program logging section** on this same screen: same calendar-date + per-metric logging pattern, but sourced from `state.teamProgram.activities` instead of a personal Program. The athlete chooses, per log entry, whether they're logging against a personal Program or the Team Program.
15. **[Cosmetic]** Retain the Recent Workouts section exactly as built, including PR detection/highlighting (`entryPRs()`, `workoutHistoryTable()`).

---

## Player Card (`#player`)

16. **[Deferred, flagged as low-value until reworked]** No functional changes requested this round, but Kurt is explicit that this screen has little value until it looks like a real baseball-card back — stats/ratings arranged around the athlete's avatar. Cosmetics/skins/unlockable card frames are an explicit longer-term roadmap item, gated on having genuinely good avatar artwork (also future work, not this round). No action needed now beyond being aware this page is a priority for a future visual pass.

---

## Weekly Combine → rename "Combine Testing" (`#combine`)

17. **[Cosmetic]** Rename this tab/screen from "Weekly Combine" to **"Combine Testing"** everywhere it appears (subnav label, screen heading).
18. **[Cosmetic]** Add a short context note recommending this be done every **6-8 weeks** (this is guidance copy only — no reminder/scheduling logic requested).
19. **[Functional]** Pre-populate the form with the exercises currently in the athlete's active Program(s) rather than starting blank. Ambiguous whether this replaces the fixed core benchmark fields (max push-ups, squat-60, plank, broad jump, sprint) or just auto-fills the two "Extra Exercise" custom slots that currently start as blank dropdowns — see Open Questions.
20. **[Cosmetic/none]** Retain the parent-code approval gate, the save behavior, and the history section exactly as built.

---

## Quests & Battles (`#quests`)

21. **[Functional]** Once a quest or boss battle is completed, mark it completed and prevent re-awarding it for the remainder of the week; reset availability at the start of each week. This is a real behavior change from today's code, which explicitly allows repeat completions (see `README.md`: "Boss Battles can be completed more than once if the parent wants to award repeat bonuses"). Needs an explicit week-boundary definition — see Open Questions.
22. **[Needs clarification]** The note "the XP values" is incomplete in the source feedback — flagged rather than guessed at. See Open Questions.

---

## Progress (`#charts`)

23. **[No change]** Retain as designed.

---

## Reward Locker → "Rewards" / payment-center model

24. **[Structural]** Reframe the Home Run Meter as a **spendable balance**, not a lifetime total: available balance = total XP earned minus total XP already spent on claimed rewards. Note that `state.claimedRewards` already exists as an empty array in the defaults object — it looks like this was anticipated but never wired up; this is the natural place to record `{ milestoneXP, dateClaimed, approvedBy }` entries.
25. **[Functional]** Claiming a reward requires parent approval (reuse the existing parent-code pattern used elsewhere), and on approval the milestone's XP cost is deducted from the available balance.
26. **[Functional]** A milestone shows as "available to claim" only while the current available balance is ≥ that milestone's XP cost; otherwise it shows "locked." Important behavior change: because balance can now go down (after spending), a previously-claimable milestone can become locked again if the balance drops below it. Confirm this is intended — see Open Questions.
27. **[Deferred]** A real "store" experience is explicit future roadmap, not this round — for now this remains closer to an honor-system flow where parents manually approve claims.
28. **[No change]** Retain the XP Ledger exactly as built (`xpEvents()`/the ledger list).

---

## XP Structure & Balance (cross-cutting — touches Workouts, Quests, Arcade, Rewards)

29. **[Functional]** Rebalance the XP economy so that no single workout alone gets meaningfully close to a reward. Rough target Kurt described: roughly 10 workouts' worth of XP for a small reward; a sizable reward should require many workouts *combined with* other site activity (arcade, quests, coach bonuses) — not workouts alone. This means revisiting the constants in `xp()`/`workoutXPForEntry()` (currently a flat 25 XP per workout, 75 per verified combine, plus PR/streak bonuses) against the reward milestone thresholds (`rewardMilestones`: 250/500/750/1000/1500/2000/3000).
30. **[Already partially built]** "Hot streak" XP bonuses are requested — note `workoutXPForEntry()` already adds +10 XP once `streak() >= 3`. This likely just needs expanding into a proper escalating tier (e.g., bigger bonus at 7 days, bigger still at 14+) rather than being built from scratch.
31. **[Functional]** Kurt's suggested mental model is a "prize-giveaway hierarchy" — i.e., the same common/uncommon/rare weighting logic requested for the Arcade wheel below is a reasonable pattern to reuse for reward-tier spacing generally.

---

## Team Dashboard (`#team`)

32. **[No change]** Retain team summary stats, leaderboard, and team feed as designed.
33. **[Structural]** Merge **Positive Reactions** and **Coach + Parent Shout-Outs** into a single unified feed. All entries — reactions and shout-outs alike — are positive-only and can originate from teammates, coaches, or parents. This effectively combines two currently-separate UI blocks and their underlying data (`state.shoutouts` plus the currently non-persisted reaction-button clicks) into one feed data source.
34. **[Cosmetic/Functional]** Keep the Team Program summary card as a visual reminder of the current program, and add a coach-authored free-text instructions field (e.g., "Please attempt to complete this program 2x per week") that displays alongside it. This note should be entered from the coach-tools builder (moving to Parent, see below) and rendered here.
35. **[Functional]** Remove the "Leave Program" toggle. Currently `joinTeamProgram()` toggles opt-in/opt-out; change so joining is one-directional (or confirm intended behavior — see Open Questions).
36. **[Cosmetic/Functional]** Remove the "Coach Tools" block (the program builder currently on this page) entirely from Team Dashboard — it moves to the Parent tab.

---

## Arcade (`#arcade`)

37. **[No change]** Retain the current top summary-of-bests header and the three mini-games (Reaction Catch, Strike Zone, Home Run Timing) as-is.
38. **[Functional]** Change the daily prize wheel (`buildWheelSVG()`/`wheelSegments`) so slice size is weighted by prize value rather than all slices being equal angle (current code divides 360° evenly across all segments — this needs to become a weighted-angle build). Requested tiers:
    - Standard size: 5, 10, 15, 20, 25
    - 30% smaller than standard: 50, 100
    - 50% smaller than standard: 250
    - 75% smaller than standard: 1000
    Note current `wheelSegments` array is `[10,10,15,20,20,25,25,50,50,100,250,1000]` — add a 5-value segment and rebuild the angle math to reflect the tiers above (rarer/bigger prizes get visually smaller wedges).
39. **[Cosmetic]** Make the wheel graphic larger/more visually prominent on screen.
40. **[Deferred]** Daily Trivia stays as-is functionally; Kurt wants a larger trivia question bank in the future (roadmap note, not this round).
41. **[No change]** Retain the Arcade leaderboard as designed.

---

## Parent → rename "Coach/Parent Corner" (`#parent`)

42. **[Cosmetic]** Rename this tab from "Parent" to **"Coach/Parent Corner"** everywhere it appears.
43. **[Functional]** Move the Team Program builder here from Team Dashboard (see item 36) — same parent-code-gated form (`saveTeamProgram()`), relocated.
44. **[Functional]** Add a field on that builder for free-text program instructions/notes, which then displays on the Team Dashboard's program summary card (see item 34).
45. **[No change]** Retain the other existing parent/coach functions as built: parent code settings, Parent Bonus XP award form, pending combine-test approval, and the backup/export/import/reset tools.

---

## Open Questions Needing Confirmation Before Implementation

1. **Clubhouse "LVL 1" removal (item 4):** the only LVL element in the app lives in the persistent top status bar, shown on every screen. Confirm removal is site-wide, not Clubhouse-only — or clarify if there's a different "LVL" reference intended.
2. **Combine pre-population (item 19):** does pre-populating from the athlete's active Program replace the fixed core benchmark fields (push-ups, squat-60, plank, broad jump, sprint), or just auto-fill the existing "Extra Exercise" custom slots that currently default to blank?
3. **Quests & Battles (item 22):** the note "the XP values" is cut off in the source feedback — please clarify what the intended instruction was.
4. **Weekly reset boundary (item 21):** what defines "week" for quest/battle reset — calendar week starting Sunday or Monday, or a rolling 7-day window?
5. **Reward Locker re-locking (item 26):** confirm it's intended that a milestone can go from "available to claim" back to "locked" if the balance drops below it again after a claim (rather than staying permanently unlocked once first reached, which is how it behaves today).
6. **Team Program "leave" (item 35):** should "Join Team Program" become a one-way action with no way to leave via the UI, or should the leave option be removed but a coach/parent retain the ability to remove an athlete from the program elsewhere?
7. **Daily Check-In calendar (item 12):** is the current native `<input type="date">` (which already opens a calendar picker in most browsers) sufficient, or is a different in-page calendar widget specifically wanted?

---

## Suggested Build Order

Given the Cosmetic/Functional/Structural tags above, and consistent with the earlier sequencing discussion (settle data shape before the Supabase migration):

1. **Cosmetic-only items first** (Home numbers, subnav reorder, renames, wheel size/visual prominence) — zero risk, no dependencies, can ship immediately.
2. **Resolve the Open Questions above** before touching Daily Check-In, Combine, Quests, or Reward Locker — several of those builds depend on the answers.
3. **Structural items next, together**: the Programs model (items 6-15), Team Program logging (item 14), and the Rewards balance/ledger model (items 24-27) are the three real data-shape changes in this round. Design and build these as a group — they're the pieces that will become Supabase tables later, so it's worth getting their shape right now rather than iterating twice.
4. **Remaining functional polish** (merged Team feed, XP rebalancing, wheel weighting) can follow once the structural pieces are in place, since a couple of them (XP rebalancing) depend on the Programs/Rewards shape being settled first.
