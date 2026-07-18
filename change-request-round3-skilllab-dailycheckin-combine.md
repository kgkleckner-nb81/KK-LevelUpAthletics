# Level Up Athletics — Change Request, Round 3: Skill Lab, Daily Check-In, Combine Testing

**For Claude Code.** Same tagging convention as the last round: **[Cosmetic]** (visual/copy only), **[Functional]** (behavior using data that already exists), **[Structural]** (changes the shape of `state`).

**Relationship to `change-request-round2.md`:** this document refines and **supersedes** that document's Daily Check-In section (items 8-15), Skill Lab section (items 6-7), and the Combine pre-population question (item 19 / Open Question 2 — now resolved, see below). Everything else in round2 (Home, Clubhouse, Player Card, Quests & Battles, Reward Locker, Team Dashboard, Arcade, Parent) is unaffected and still active — build this round on top of it, not instead of it.

**Read "Cross-Cutting Risk" near the end before starting.** This round's Daily Check-In change removes the flat named fields (`pushups`, `squats`, `plank`, etc.) that the Player Card rating engine currently reads directly — that engine has to be updated in the same pass or scores will silently break.

---

## Skill Lab (`#library`) — Workout Builder

1. **[No change]** The core builder flow already works as intended: create/name a program, then add Skill Lab activities to it.
2. **[Functional]** Prevent the same skill from being added to a program twice — dedupe on add.
3. **[Structural]** Add a **"Save Program"** button that persists the in-progress program. This is the write side of the `Program { id, name, activityIds[] }` entity from round2 item 8 — build them together, not separately.
4. **[Functional]** Change the "Add to Program" button's visibility rule: it should only appear while the athlete is actively inside the Workout Builder (creating or editing a program). Outside of that mode — i.e., browsing the library normally, including browsing a program that's already been saved — every skill shows only the existing "View" action (opens the How to Perform / Demo Video / How to Track detail, `renderActivityDetail()`), never "Add." Today's `renderExerciseLibrary()` always renders both a View and an Add/disabled-Add button; this changes to: Add button only rendered when `builderMode === true`.
5. **[Structural]** Add three preset programs, pre-populated (not athlete-editable at creation, but presumably viewable/usable the same as an athlete-built program). Mapped to the exact activity names already in `activityDefs` so there's no name-matching ambiguity:

   - **Level 1: Base Camp** — Push-ups, Squats, Skater Jumps, Lateral Shuffle, Plank, Broad Jump, 20-yard Sprint
   - **Level 2: The Grind** — Push-ups, Jump Squats, Skater Jumps, Sit Ups, Plank, **Drop Lunges** (new — see item 7)
   - **Level 3: Boss Level** — everything in The Grind, plus Wall Sit, Single-Leg Hops

6. **[Functional]** Retire the `fixedExerciseAliases` concept entirely (`Push-ups`, `Squats`, `Sit Ups`, `Skater Jumps`, `Lateral Shuffle`, `Broad Jump`, `20-yard Sprint`, `Plank`). Today these are marked "Tracked Daily" in the library with their Add button permanently disabled, because the old Daily Check-In auto-tracked them as fixed fields regardless of any program. That auto-tracking goes away this round (see below), so these become normal, fully addable Skill Lab activities like everything else — this is the "add back the skills that are indicated in the daily check-in" request. No skills need to be re-created; they already exist in `activityDefs`, they just need to stop being excluded/disabled.
7. **[Structural]** Add a new activity, **Drop Lunges** — doesn't exist in the catalog today. Suggested placement: Strength category, reps-based metric (matching the `repsSetsPlain`-style builder used for similar lower-body bodyweight moves), labeled to reflect "each leg" (e.g., reps field labeled "Reps (each leg)"). Confirm category/label before finalizing — see Open Questions.

---

## Daily Check-In (`#daily`)

8. **[Structural]** Remove auto-populating entirely. Today's form has two sources of fields: (a) eight hardcoded named inputs (squats, pushups, plank, crunches, broadJumps, shuffleTouches, skaterJumps, sprints) that always show regardless of any program, and (b) up to 4 slots from the old `trainingSlots` array. **Both go away.** The only fields shown are whatever activities belong to the athlete's selected Program.
9. **[Functional]** If the athlete has exactly one Program, it's selected automatically, no picker shown. If they have more than one, show a picker to choose which Program populates the form.
10. **[Cosmetic]** Keep the date field as-is (native calendar date picker).
11. **[Structural]** Remove the RPE/"Effort" 1-10 button scale entirely (this is the `rpe` metric key, labeled "Effort" in code, currently part of the `repsSets` and `weightSetsReps` metric builders). Every exercise going forward tracks either **reps** or **time (duration)** — whichever is appropriate for that exercise — nothing else. See Open Questions re: whether this also means dropping weight/load tracking for now.
12. **[Structural]** Replace the "Sets" number-input field with an **"Add Set" button** per exercise. Each exercise starts with one set's worth of input (reps or duration, per item 11); tapping "Add Set" appends another instance of that same input so the athlete can log a second, third, etc. set of the same exercise in the same day's entry. This changes the stored shape for a logged activity from a single values object (e.g. `{reps:8,sets:3}`) to a **list of set entries** (e.g. `{sets:[{reps:8},{reps:10},{reps:12}]}` for a reps-based exercise, or `{sets:[{duration_sec:45}]}` for a duration-based one). Recommend this shape explicitly rather than improvising one — see Cross-Cutting Risk below for why the shape matters beyond this screen.
13. **[Functional]** "Save Workout" formally records/persists the entry (as today), but:
14. **[Cosmetic]** Remove "+ Open Pack" from the button label and stop triggering the pack-reveal UI (`openPack()` / `#packReveal`). Worth confirming for whoever picks this up: that reveal is purely decorative flavor text today (static "+25 XP" / "Card Pack" / "Mystery Chance" cards) — it doesn't grant anything beyond what `xp()` already computes elsewhere, so removing it doesn't cut any real functionality, just the animation/copy around it.

### Team Program Check-In (new block on the same screen)

15. **[Structural]** Add a second logging block below/alongside the personal-program one, populated from `state.teamProgram.activities` — same date + per-exercise reps-or-time + Add Set pattern as above — but only shown if `state.teamProgramOptIn` is true. This also counts as a logged workout (same downstream XP/streak/PR treatment as a personal-program entry). Recommend storing these in the same log array as personal-program entries, tagged with which program (and program type: personal vs. team) they belong to, so Recent Workouts and the rating engine can treat them uniformly rather than needing two parallel code paths — flagged as a recommendation, not a hard requirement, since it wasn't specified at this level of detail.

### Recent Workouts

16. **[No change / confirmation only]** Continues to list whatever's been explicitly saved via "Save Workout" — this is already how `state.daily` works today; no functional change needed here beyond reflecting the new per-set data shape in the display.

---

## Combine Testing (`#combine`)

17. **[Cosmetic]** Move this tab one position left in the athlete subnav: **after Daily Check-In, before Player Card.** Combined with round2 item 3 (Skill Lab moved next to Clubhouse), the full resulting order is: **Clubhouse → Skill Lab → Daily Check-In → Combine Testing → Player Card → Quests & Battles → Progress → Reward Locker.**
18. **[Functional]** Add a control for the parent/coach to select which Program to test against.
19. **[Functional]** Once selected, the form populates with data fields for that Program's exercises, for the parent/coach to record as a formal combine result. This resolves round2's Open Question 2 (whether Combine pre-population replaces the fixed benchmark fields or just the extra slots) — **it replaces them**: Combine Testing is now entirely Program-driven, matching Daily Check-In's model rather than keeping its own fixed push-up/squat/plank/broad-jump/sprint fields.
20. **[No change]** Combine History stays as-is.

---

## Cross-Cutting Risk — read before implementing

The Player Card rating engine (`pr()`, `score()`, `ratings()` in `app.js`) currently reads **flat, hardcoded field names** directly off each `state.daily` entry — `entry.pushups`, `entry.squats`, `entry.plank`, `entry.crunches`, `entry.broadJumpIn`, `entry.sprintSec`, `entry.shuffleTouches`, `entry.skaterJumps` — and the `benches` scoring table is keyed to those same names. Coach's Report (`renderCoachReport()`) and the Progress charts (`renderCharts()`/`dailyValueFor()`) key off the same fixed field names too.

Once Daily Check-In stops writing those flat fields (item 8) and instead writes generic per-activity, per-set entries keyed by Program/activity id (item 12), **all three of those — Player Card ratings, Coach's Report, and Progress charts — need to be rewritten in the same pass** to read by matching on activity name/id against the new log shape, or they will silently freeze/zero out even though workouts are still being logged correctly. This isn't optional cleanup — it's required for this round to ship without quietly breaking Player Card. Treat items 8-19 above and this rating-engine update as one unit of work, not a follow-up.

---

## Open Questions Needing Confirmation

1. **Drop Lunges (item 7):** confirm category placement (Strength suggested) and whether "(each leg)" should be tracked as one reps number per set, or two separate left/right numbers per set.
2. **Removing "effort" (item 11):** confirm this also means dropping weight/load as a trackable metric for now (all current preset-program exercises are bodyweight, so this may be moot in practice) — or whether weight should remain available for any future weighted exercise, just without RPE attached to it.
3. **Team Program log storage (item 15):** confirm storing team-program entries in the same log array as personal-program entries (tagged by program type/id), versus a fully separate array — the recommendation above is to unify them so the rating engine and Recent Workouts don't need two code paths, but flagging since it wasn't specified explicitly.
