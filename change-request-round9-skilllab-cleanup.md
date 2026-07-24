# Level Up Athletics — Change Request, Round 9: Skill Lab Consolidation

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**, **[Structural]**.

**Background:** this round distills a research summary on youth bodyweight/plyometric training into the existing Skill Lab (`activityDefs`, `categoryAxisMap`, `sampleMedia` in `app.js`). Goal: shrink an 11-category, baseball-mixed exercise list down to a curated, sport-agnostic library organized by athletic quality, quarantine the baseball-specific content for a future dedicated module rather than deleting it, add a kid-friendly "goal" browsing mode, and add a multi-attribute contribution display per exercise. Ratings/promotion logic (Round 5) is **not** being redesigned here — see the hard constraints below.

**Two load-bearing facts to hold in mind through this whole round:**
1. Several exact exercise-name strings are read directly by `pr()`, `axisStatNames`, and `benches` in the rating engine: **`Push-ups`, `Squats`, `Plank`, `Lateral Shuffle`, `Skater Jumps`, `Broad Jump`, `20-yard Sprint`**. These seven names must not be renamed, retyped, or removed — `bestActivityValue()` looks them up by exact string match. Everything else in the library is free to rename/reorganize/remove.
2. `categoryAxisMap` is keyed by category *name*. Any category you rename below (Agility→Quickness, Power→Jumping/Plyometrics) must have its `categoryAxisMap` key updated to match, or `whyTrackLine()` silently falls back to "training consistency" for every exercise in that category.

---

## Part 1 — Quarantine Baseball-Specific Content (don't delete it)

1. **[Structural]** Move the `Throwing`, `Catching`, `Hitting`, and `Pitching` categories — and their exercises, including the `Tee Work` entry in `sampleMedia` — out of `activityDefs` entirely and into a new, separate `baseballActivityDefs` object that nothing currently reads. This keeps the content intact (including its authored coaching text) for a future "Baseball Skill Lab" module — consistent with the longer-term plan to add sport-specific labs — without it showing up in the general Skill Lab today.
2. **[Structural]** Also move `First-Step Reaction` and `Base-Stealing Starts` out of the `Speed` category into `baseballActivityDefs` — both describe base-running-specific movement patterns, not generic speed work.
3. **[Cosmetic]** `baseballCategories` (the Set used to tag `sportTags`) becomes dead code once its members no longer exist in `activityDefs` — remove it, and simplify `sportTags` to always read `['multi-sport']` for now. Leave the `sportTags` field itself in place on each activity (don't delete the field/plumbing) — it's the natural re-entry point when a sport-specific lab returns.
4. **[Cosmetic]** The exercise-library card template currently shows a hardcoded `⚾` on every card regardless of category (`renderExerciseLibrary()`, the `<span>⚾</span>` in the card markup) — a leftover from when the library was baseball-first. Replace it with a category-appropriate glyph (e.g. 💪 Strength, 🧱 Core, ⚡ Speed, 🏃 Quickness, 🚀 Jumping/Plyometrics, ⚖ Balance, 🎯 Coordination, 🧘 Mobility) or remove the icon if a simpler card reads better. Treat exact glyph choice as tunable.

---

## Part 2 — Consolidated Category List & Exercise Library

5. **[Structural]** Replace the current 7 general categories (Strength, Core, Speed, Agility, Power, Recovery, plus the now-quarantined baseball ones) with **8 renamed/consolidated categories**, in this order: `Strength`, `Core`, `Speed`, `Quickness` *(renamed from Agility)*, `Jumping/Plyometrics` *(renamed from Power)*, `Balance` *(new)*, `Coordination` *(new)*, `Mobility` *(renamed from Recovery)`. Leave `Teamwork` exactly where it is — it's not an athletic-quality category and is out of scope this round.
6. **[Functional]** Rebuild each category's exercise list as follows. Names in **bold** are the seven load-bearing names from the note above — copy them verbatim.

   **Strength:** **Push-ups**, Wide Push-ups, **Squats**, Jump Squats, Glute Bridge, Drop Lunges, Pull-Ups *(new)*, Dead Hang *(new)*. Remove Wall Sit and Calf Raises (both flagged for removal in the research — bodyweight-strength curation, not plyo/hold work) — see item 8 for what happens to Wall Sit's existing content.

   **Core:** **Plank**, Side Plank, Hollow Hold, Dead Bugs, Bird Dog *(new)*, Bear Crawl *(new)*. Remove Sit Ups, Bicycle Sit Ups, and Superman — see item 9 for the Sit Ups dependency you need to resolve.

   **Speed:** 10-yard Sprint, **20-yard Sprint**, 40-Yard Sprint *(new)*, Hill Sprint *(new)*, Flying Sprint. (Shuttle Run moves to Quickness below; First-Step Reaction and Base-Stealing Starts are quarantined per item 2.)

   **Quickness:** **Skater Jumps**, **Lateral Shuffle**, Shuttle Run *(moved from Speed)*, Carioca, Zig-Zag Cones, Box Drill. Do not add "Skater Bounds" from the research list — it's the same movement pattern as Skater Jumps under a different name; adding both would just be a near-duplicate entry.

   **Jumping/Plyometrics:** **Broad Jump**, Vertical Jump, Single-Leg Hops, Lateral Hops, Squat Jump *(new)*, Box Jump *(new)*, Tuck Jump *(new)*, Jump Rope *(new)*, Pogo Jumps *(new)*.

   **Balance** *(new category, no existing conflicts)*: Single-Leg Balance, Single-Leg Reach, Heel-to-Toe Walk.

   **Coordination** *(new category, no existing conflicts)*: High Knees, Butt Kicks, Ladder Quick Feet, Crossovers *(replaces the old "Crossover Runs" — same movement, one name)*, Mountain Climbers.

   **Mobility:** Hip Mobility, Shoulder Mobility, World's Greatest Stretch *(new)*, Deep Squat Hold *(new)*, Hamstring Stretch *(new)*, Thoracic Rotation *(new)*. Remove Band Work and Foam Rolling — both imply equipment (resistance bands, a foam roller), which conflicts with the bodyweight-only premise this cleanup is built on. Remove the generic "Stretching" entry in favor of the named stretches above.

   This lands at 48 total exercises across the 8 categories plus Teamwork — inside the research summary's recommended 30-50 range.

7. **[Functional]** Update `presetDefs` (the three ready-made programs): Level 2 "The Grind" currently includes `Sit Ups`, and Level 3 "Boss Level" currently includes `Wall Sit` — both removed above. Swap each for a same-category replacement from the new list (e.g. Hollow Hold or Dead Bugs in place of Sit Ups; your judgment call on the Wall Sit replacement). Confirm no preset references a name that no longer exists in `activityDefs` before considering this done.
8. **[Cosmetic — your call]** `Wall Sit` currently has real authored `sampleMedia` content (instruction text, form cues, common faults) that would otherwise be deleted along with the exercise. `Hollow Hold` has no authored content today. Consider rewriting Wall Sit's content into a Hollow Hold entry rather than losing it outright — not required, just don't discard good writing by default.
9. **[Resolved]** `coachReport()`'s "Next goals" text currently reads `r.crunches` (fed by `pr().crunches`, which is `bestActivityValue('Sit Ups')`) to print a "next goal: N sit ups" line. Since Sit Ups no longer exists as a loggable exercise, this line would go stale. **Decision: drop the sit-ups clause entirely** rather than substitute a replacement stat — the line becomes just push-ups and plank goals. No Calf Raises text change is needed anywhere — `coachReport()` never referenced Calf Raises in the first place, only Sit Ups/crunches.

---

## Part 3 — "What Do You Want to Get Better At?" Goal Navigation

10. **[Functional]** Add a goal-based entry point to the Skill Lab card, sitting alongside (not replacing) the existing `#libraryCategory` dropdown — e.g. a row of chips/buttons: 💪 Stronger, ⚡ Faster, 🏃 Quicker, 🚀 Jump Higher, 🛡 More Durable, ⚖ Better Balance, 🎯 Better Coordination, 🧘 More Flexible. Because the 8 renamed categories already line up one-to-one with these 8 outcomes, each chip just needs to set `#libraryCategory`'s value to its matching category and re-render the existing library view — no new data structure or tagging system required. Mapping: Stronger→Strength, Faster→Speed, Quicker→Quickness, Jump Higher→Jumping/Plyometrics, More Durable→Core, Better Balance→Balance, Better Coordination→Coordination, More Flexible→Mobility.
11. **[Cosmetic]** Kids should be able to land on this view by outcome without knowing the word "category" first — put the goal chips visually above the dropdown, and treat the dropdown as the secondary/precise way to get there (useful once an athlete already knows what they're looking for).

---

## Part 4 — Per-Exercise Attribute Contribution (display only — hard boundary)

12. **[Structural]** Extend each general (non-baseball) activity definition with a small attribute-weight map, e.g. `{Strength:3, Core:1}` for Push-ups, following the pattern: each exercise gets one primary-attribute weight matching its category (Strength category exercises primarily feed Strength, etc.) plus, where it makes obvious sense, one secondary attribute at a lower weight — mirroring the research's own examples: Push-Ups → Strength + Core, Broad Jump → Jump + Speed, Bear Crawl → Core + Coordination, Jump Rope → Coordination + Quickness. The 7 trackable attributes are Strength, Speed, Quickness, Jump, Core, Balance, Coordination — Mobility exercises don't carry an attribute weight (stretch/prep work, not a rated quality). Exact secondary-attribute assignment for all 48 exercises is your judgment call using that pattern — a fully hand-authored, exhaustively-tuned version of this belongs in a future standalone Skill Lab design document, not this round.
13. **[Functional]** After each Daily Check-In log, accumulate that entry's attribute weights into a new `state.attributePoints` object (`{Strength: 142, Core: 88, ...}`) and surface it somewhere visible — e.g. a new small "Attribute Breakdown" panel on the Player Card showing relative bars/percentages across the 7 attributes. Purely additive, informational display — an athlete should be able to see "you've been training Coordination the least" at a glance.
14. **[Hard constraint — do not violate]** `state.attributePoints` must **never** be read by `ratings()`, `pr()`, or `score()`. This is the same non-negotiable boundary Round 8 established for `state.arcadeMetrics` — the four Player Card rating axes stay Combine-dominant per Round 5, and this new attribute display must not become a backdoor way to inflate a rating.

---

## Explicitly Out of Scope This Round

- The full "Skill Lab Design Guide" (exhaustive per-exercise coaching cues/common-mistakes authoring, hand-tuned attribute weights for all 48 exercises, unlock/progression trees, database schema, UI wireframes) — deferred to a separate standalone document, not this code change.
- Per-exercise "unlocks" (e.g. Push-Up → Diamond Push-Up) and "Related Skills" cross-links — a future Skill Lab enhancement, not part of this consolidation pass.
- Difficulty star ratings (★★☆☆☆) per exercise — not requested this round.
- Any real video content — the placeholder pattern from Round 3 is untouched.
- Rebuilding or reweighting `ratings()`/`pr()`/`score()` — Round 5's rating engine is not being revisited here.
- Building the future Baseball Skill Lab module itself — this round only quarantines the content so it's ready to become that later.
- Renaming or restructuring `Teamwork` — untouched.

---

## Acceptance Criteria

- [ ] `activityDefs` contains exactly the 8 renamed general categories plus `Teamwork`; `Throwing`/`Catching`/`Hitting`/`Pitching` no longer appear in it.
- [ ] `baseballActivityDefs` exists, is not referenced by `categoryOrder`/`activities`/the Skill Lab UI, and contains the quarantined content (including `Tee Work`'s sampleMedia, `First-Step Reaction`, and `Base-Stealing Starts`).
- [ ] Grep confirms `Push-ups`, `Squats`, `Plank`, `Lateral Shuffle`, `Skater Jumps`, `Broad Jump`, and `20-yard Sprint` still exist verbatim in the active `activityDefs`.
- [ ] `categoryAxisMap`'s keys match the renamed categories (`Quickness`, `Jumping/Plyometrics`) — `whyTrackLine()` no longer falls back to "training consistency" for exercises in those categories.
- [ ] `presetDefs` contains no reference to a removed exercise name (Sit Ups, Wall Sit, Calf Raises, etc.).
- [ ] `coachReport()` no longer references `r.crunches`/Sit Ups.
- [ ] The Skill Lab shows both the goal chips and the category dropdown, and clicking a goal chip filters to the correct category.
- [ ] `state.attributePoints` exists, accumulates from Daily Check-In logs, and displays somewhere on the Player Card — but grep confirms it is not referenced anywhere inside `ratings()`, `pr()`, or `score()`.
- [ ] No new `<script src>` or package dependency has been added.
