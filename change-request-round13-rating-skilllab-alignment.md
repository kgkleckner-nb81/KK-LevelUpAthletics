# Level Up Athletics — Change Request, Round 13: Rating Engine ↔ Skill Lab Alignment

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**, **[Structural]**.

**Background:** the Player Card rating engine (`ratings()`, `score()`, `pr()`/`bestActivityValue()`) and the Skill Lab (`activityDefs`, `categoryAxisMap`) are two disconnected systems today. The rating engine only scores four axes — Speed, Strength, Power, Agility — plus Consistency, while the Skill Lab (post-Round 9) organizes training into 8 categories plus Teamwork. Core, Balance, Coordination, and Mobility can be trained all day in the Skill Lab and never move the Player Card. Making it worse, Round 9's `state.attributePoints` "Attribute Breakdown" panel tracks all 7 trainable attributes but was deliberately firewalled from ever touching `ratings()` — so a kid sees a bar fill up that can never affect their card. This round removes that dead-end panel and rebuilds the rating engine so its axes are the Skill Lab's categories, scored from a real blend of effort, verified testing, and coach judgment.

**This round supersedes:** Round 9, Part 4 (items 12-14, the `attributePoints`-is-display-only design) and the "Hard constraint" in that section. Round 5's checkpoint-gated ladder/promotion logic (Part 2) is **not** being redesigned — it stays, just re-pointed at the new axis list.

---

## Part 1 — Axis List

1. **[Structural]** Replace the five rated axes (`speed`, `strength`, `power`, `agility`, `consistency`) with **six performance axes plus Consistency**, mapped 1:1 to Skill Lab categories:

   | New Axis | Skill Lab categor(y/ies) it covers |
   |---|---|
   | Strength | Strength |
   | Speed | Speed |
   | Quickness | Quickness |
   | Jump/Power | Jumping/Plyometrics *(rename `power` key to `jumpPower` internally, display label "Jump/Power")* |
   | Core | Core |
   | Body Control | Balance **and** Coordination, combined into one axis *(per Kurt's decision — do not keep these as two separate rated axes)* |

   Mobility remains untracked/unrated, same as today — recovery work, no axis. `categoryAxisMap` needs `Balance` and `Coordination` both pointing at the same `bodyControl` axis key; confirm `whyTrackLine()` doesn't assume a 1:1 category-to-axis mapping when you make this change, since this is the first many-to-one case.

2. **[Structural]** Teamwork does **not** get its own rated axis. Instead, completed Teamwork activities (Skill Lab log entries in that category) become an additional input into the existing Consistency axis, alongside workout count and streak — see Part 3, item 8.

3. **[Cosmetic]** Player Card rating rows become: Strength, Speed, Quickness, Jump/Power, Core, Body Control, Consistency (7 rows) feeding one Overall. Remove the standalone "Attribute Breakdown" panel entirely — `state.attributePoints` no longer renders as its own section anywhere on the Player Card.

---

## Part 2 — Kill the Standalone Attribute Panel, Fold It Into Scoring

4. **[Structural]** Repurpose `state.attributePoints` (currently an inert, uncapped, ever-growing tally with a hard constraint against ever being read by `ratings()`) into a **real, capped input** to its matching axis's score instead of a side display. This is the "completion" leg of the three-part blend in Part 3. Remove the Round 9 hard-constraint comment/guard that prevented this.
5. **[Functional]** Since `attributePoints` today accumulates forever with no decay, add a rolling-window or per-season reset (align with the Mid-Season/End-of-Season checkpoint boundaries already established in Round 5) so a strong first month doesn't permanently pad the completion score for the rest of the athlete's time in the app.

---

## Part 3 — Per-Axis Scoring Formula

6. **[Structural]** For each of the six performance axes (not Consistency — see item 8), compute the axis score as a capped blend of three inputs, replacing Round 5's two-input model (Combine + capped Daily Check-in):

   - **Verified Combine / graded-timed result — dominant, ~55-65% of the axis.** Same source as today: the latest verified Combine Testing entry for that category's benchmark exercise(s), run through the existing continuous `score()` curve (Round 5, item 3 — unchanged).
   - **Completion/volume — capped minority, ~10-15% of the axis.** Fed by the repurposed `attributePoints` value for that axis (item 4), capped so pure logging volume alone can't meaningfully move the number — this is what makes the rating twitch nominally week to week just from putting in the work, without letting volume substitute for real performance.
   - **Coach grade — ~20-30% of the axis, new.** See Part 4 below — does not exist in the app today.

   Treat the exact split as a tunable starting point (Round 5 already established this "treat as tunable" framing for its own weights); the shape — Combine dominant, completion capped small, coach grade a real but non-dominant third — is what matters.

7. **[Structural]** Keep Round 5's checkpoint-to-checkpoint improvement bonus (~10 pts, capped) exactly as designed — awarded only when an axis's **verified Combine** result measurably improves between the Mid-Season and End-of-Season checkpoints. This stays the primary mechanism that keeps 99 out of easy reach: neither daily completion nor a single good coach grade can substitute for demonstrated, verified improvement across the season. Apply it across all six axes now instead of the original four.
8. **[Functional]** Consistency's formula gains one new input on top of its existing workout-count + streak calculation: completed Teamwork activities from the Skill Lab (item 2). Keep Teamwork's contribution capped the same way the Daily Check-in contribution is capped elsewhere, so it nudges Consistency rather than dominating it.
9. **[Functional]** Overall stays a straightforward average across all seven axes (six performance axes + Consistency), matching today's aggregation approach — no new weighting scheme for Overall itself this round.

---

## Part 4 — Coach Grade (new mechanic)

10. **[Structural]** No coach-rating input exists anywhere in the app today — this is genuinely new. Add a coach-grade entry to the existing Combine Testing flow (`#combine`), gated the same way Combine results already are (parent/coach code): at each Combine checkpoint, alongside the recorded test result(s), the coach/parent enters a **1-10 grade per axis** for that athlete. Store it on the same Combine record as the verified test data so it's timestamped to the same checkpoint.
11. **[Functional]** Normalize the 1-10 coach grade onto the same 0-99-ish scale the rest of the engine uses before blending it into the axis score (e.g., linear map 1→~40, 10→~99 — pick a mapping consistent with how `score()` already scales Combine results, rather than a separate unrelated scale).
12. **[Functional]** If no coach grade has been entered yet for a checkpoint (early beta, or a coach who skips this field), fall back to redistributing that ~20-30% weight proportionally across the Combine and completion inputs for that axis rather than scoring it as zero — a missing coach grade shouldn't tank an axis.

---

## Part 5 — Cross-Cutting Cleanup

13. **[Functional]** `benches`/`categoryAxisMap`/`axisStatNames` need entries for the two now-rated axes that didn't exist before as rating axes: Core and Body Control. Confirm benchmark values for Core (Plank, etc.) and Body Control (pulling from both Balance and Coordination exercises) before finalizing — flagged as an Open Question below since these don't have prior benchmark data to build from.
14. **[Functional]** `coachReport()`'s auto-generated text and any Progress chart (`renderCharts()`) references to the old `power`/`agility` axis keys need updating to the renamed `jumpPower`/`quickness`/`bodyControl` keys so nothing silently goes stale, following the same pattern Round 9 already used when it renamed Agility→Quickness and Power→Jumping/Plyometrics at the Skill Lab category level.
15. **[Functional]** Round 5's promotion-gate rating thresholds (55/65/75/85/93 on `ratings().overall`) were tuned against the old 5-axis average. Adding two more axes to the average changes what a given Overall number represents — flag this for re-tuning once there's real data, don't silently keep the same thresholds and assume they still mean the same thing.

---

## Explicitly Out of Scope This Round

- Rebuilding the Call-Up Ladder promotion table itself (Round 5, Part 2) beyond the threshold re-tuning note in item 15.
- Any change to XP, streaks, or the Reward Locker/Gear Locker economy (Rounds 5/12).
- A UI for coaches to manage/view grades across a whole team roster — this round only adds the per-athlete, per-checkpoint entry field. A team-wide coach dashboard is a reasonable future round once Supabase multi-user lands.
- Mobility gaining a rated axis — it stays unrated recovery work.

---

## Open Questions

1. **Exact weight split** (item 6): confirm 60/12/28-style split (Combine/completion/coach) as a starting point, or specify different numbers.
2. **Core and Body Control benchmarks** (item 13): these two axes have never had `benches` data before — need starting benchmark values (e.g., plank-hold seconds tiers for Core; a chosen Balance and/or Coordination drill's measurable metric for Body Control) before `score()` can curve them.
3. **Coach grade cadence** (item 10): confirm the grade is entered only at the two existing Combine checkpoints (Mid-Season/End-of-Season), or whether a coach should be able to update it more often.
4. **Missing-grade fallback** (item 12): confirm the proportional-redistribution approach, or specify a different default (e.g., a neutral mid-scale placeholder grade instead).

---

## Acceptance Criteria

- [ ] Player Card shows exactly seven rated rows: Strength, Speed, Quickness, Jump/Power, Core, Body Control, Consistency — no separate "Attribute Breakdown" panel remains anywhere on the card.
- [ ] `categoryAxisMap` routes both `Balance` and `Coordination` to a single `bodyControl` axis; Mobility maps to no rated axis.
- [ ] Teamwork Skill Lab completions feed into the Consistency calculation, not a standalone axis.
- [ ] Each of the six performance axes' score is a capped blend of verified Combine result, capped completion volume (from the repurposed `attributePoints`), and a normalized coach grade — grep confirms `attributePoints` is now read inside the scoring path (the old Round 9 hard-constraint comment blocking this is removed).
- [ ] A 1-10 per-axis coach grade field exists on the Combine Testing form, gated by the existing parent/coach code, and is stored on the Combine record.
- [ ] Round 5's checkpoint-to-checkpoint verified-improvement bonus still applies, now across all six performance axes.
- [ ] `coachReport()` and `renderCharts()` reference the renamed axis keys (`jumpPower`, `quickness`, `bodyControl`) with no stale references to the old `power`/`agility` keys.
- [ ] No new `<script src>` or package dependency has been added.
