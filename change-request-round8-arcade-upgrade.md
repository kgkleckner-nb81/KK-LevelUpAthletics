# Level Up Athletics — Change Request, Round 8: Arcade Upgrade

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**, **[Structural]**.

**Background:** this round is distilled from a separate research conversation about what makes youth mini-games engaging (sessions under 3 minutes, escalating difficulty curves, a distinct "skill identity" per game, visual payoff moments, and keeping Arcade's XP share modest so training stays the primary path). That research was reconciled against this app's actual existing Arcade — no external document needs to be consulted; every relevant detail from it is included below.

**Roadmap context:** this is the last planned round on the current static/localStorage architecture before the Supabase migration (real auth, login, shared database) discussed separately. Build accordingly — see the storage-abstraction note in Part 1.

**Scope decisions already made — do not relitigate these:**
- Exactly three arcade games after this round: **Home Run Hero** (glow-up of the existing Home Run Timing), **Web Gem** (glow-up of the existing Reaction Catch), and **Clutch Catch** (new). Strike Zone Challenge, the daily prize wheel, and daily trivia are **untouched** this round.
- The existing 25 XP/day arcade cap (`awardGameXP()`) and the existing unlimited-play model stay exactly as they are. Do not add a ranked-play-limit or practice-mode gating system.
- No Phaser, no canvas game library, no build step — plain HTML/CSS/JS/Canvas, consistent with the rest of this single-file, no-build-tool codebase.
- No server-side anti-cheat or score validation this round (there's no backend yet) — deferred to the Supabase migration.

---

## Part 1 — Shared Architecture (adapted to this codebase, not a multi-file module system)

The research this is based on recommended a `/arcade/games/*` folder structure with ES modules. **Don't do that here** — this app is intentionally a single `app.js`/`index.html`/`styles.css` with no bundler, and introducing a module system would be a bigger architectural shift than anything else done in this project. Instead, adapt the same underlying ideas as plain in-file structures, the same way `activityDefs`/`tierBadges` are already done:

1. **[Structural]** Add a new `state.arcadeScores` object, keyed by game id (`homeRunHero`, `webGem`, `clutchCatch`), each holding at minimum `{ best: number, lastPlayed: {score, date} }`. This is the storage layer — read/written through a small set of helper functions (e.g., `getArcadeBest(gameId)`, `recordArcadeResult(gameId, result)`) rather than scattered direct `state` access, so that when Supabase lands later, only those helper functions' internals need to change, not every call site.
2. **[Structural]** Add a `state.arcadeMetrics` object for the Player Card mapping described in Part 5 — kept **entirely separate** from `state.arcadeScores` and from anything `ratings()`/`pr()`/`score()` read. This is a hard boundary, not a suggestion — see Part 5.

---

## Part 2 — Home Run Hero (glow-up of Home Run Timing)

3. **[Cosmetic]** Rename "Home Run Timing" to **"Home Run Hero"** in the UI (card heading, arcade summary stat label).
4. **[Functional]** Replace the current binary hit/miss with **contact-quality tiers** based on where the swing lands relative to the hit zone. Suggested scoring, mapped onto the existing `left` percentage check in `swingHomer()`: Miss = 0, Very Early = 10, Early = 40, Good = 75, Perfect = 125, Late = 40, Very Late = 10. Show the specific tier reached ("PERFECT!", "Good contact", "Too early", etc.), not just a flat "Strike!"/"Home Run!" binary.
5. **[Functional]** Escalate difficulty within a play session: shorten the ball's travel time (currently a fixed 1800ms in `startHomerGame()`) slightly with each successful swing in the same session, with a sensible floor so it never becomes unfair — this gives the "starts easy, gets harder" curve the research emphasized, reset back to the starting speed each new session.
6. **[Cosmetic]** Add a short visual payoff on a Perfect result — a brief flash/particle burst/scale-up animation on the hit zone or ball, in the existing neon-blue/pink/green brand palette (not literal stadium/fireworks imagery — keep it stylized and consistent with the site's existing look, not photorealistic).
7. **[Functional]** Track personal best by score (not just "did they connect") via `state.arcadeScores.homeRunHero`, and show the delta from personal best on each result screen ("+35 above your best" or similar).
8. **[Functional]** XP awarded per swing scales with the contact tier reached (bigger award for Perfect, smaller for Early/Late, zero for Miss), still routed entirely through the existing `awardGameXP()` function and its 25/day cap — don't bypass or duplicate that cap logic.

---

## Part 3 — Web Gem (glow-up of Reaction Catch)

9. **[Cosmetic]** Rename "Reaction Catch" to **"Web Gem"** in the UI.
10. **[Functional]** Change from a single tap-and-done reaction test into a **streak/combo model**: a successful tap immediately queues the next ball (with a shorter average appear-delay than the last), building a live catch streak counter shown during play. A miss or a too-slow tap ends the round and reports the final streak.
11. **[Functional]** Escalate difficulty as the streak grows — shrink the average appear-delay and/or the target size modestly as the streak climbs. Keep the input model simple (tap only, same as today) — don't add swipe/gesture/direction input; that's a meaningfully bigger build for limited payoff and this needs to work identically well on a trackpad, a phone, and a tablet.
12. **[Cosmetic]** Add a short visual payoff at streak milestones (5, 10, 15 catches) — a brief glove/spark flash and a short encouraging line of text, in the existing brand palette.
13. **[Functional]** Track two personal bests via `state.arcadeScores.webGem`: best single reaction time (as today) and best streak length (new). Show both on the result screen.
14. **[Functional]** XP scales modestly with the streak achieved in that round, routed through the same `awardGameXP()` cap as everything else.

---

## Part 4 — Clutch Catch (new game)

15. **[Structural]** New game: several objects fall/move across the play area at once — one "target" (the correct one to tap) among a few "decoys." Tapping the target scores; tapping a decoy or letting the target get away costs a life. Recommend a simple 3-life model, or a hard time cap around 45-60 seconds — whichever keeps a full round comfortably under the site's established under-3-minute session guideline.
16. **[Functional]** Escalate difficulty over the course of a round: spawn rate increases and the decoy-to-target ratio gets harder as the round progresses.
17. **[Cosmetic]** Build this the same way the existing Reaction Catch ball is built — absolutely-positioned DOM elements animated via CSS transitions/timers — no canvas or physics library needed.
18. **[Functional]** Track personal best score via `state.arcadeScores.clutchCatch`. Add a new "Clutch Catch Best" stat to the arcade summary header alongside the existing (renamed) stats.
19. **[Functional]** XP scales with score achieved, routed through the same `awardGameXP()` cap.

---

## Part 5 — Player Card Metric Tracking (strictly separate from rating)

20. **[Structural]** Each game maps to a real athletic-skill category for future display purposes only: Home Run Hero → Timing, Web Gem → Reaction, Clutch Catch → Coordination. After each play, compute a normalized 0-100 value for that session and store it in `state.arcadeMetrics` (e.g., `{ homeRunHero: 72, webGem: 55, clutchCatch: 0 }`).
21. **[Hard constraint — do not violate]** `state.arcadeMetrics` must **never** be read by `ratings()`, `pr()`, or `score()`. Round 5 deliberately made the Player Card's real rating axes dominated by verified Combine data; arcade performance staying separate is consistent with that and must not be quietly wired in as a shortcut to a better rating. This data exists only for a possible future "Arcade Stats" display — not for this round to build, just to leave room for.

---

## Explicitly Out of Scope This Round

- Strike Zone Challenge, the daily prize wheel, and daily trivia — no changes.
- Ranked-play limits or a separate "practice mode" — the existing unlimited-play, XP-capped-at-25 model stays.
- Raising the 25 XP/day cap.
- Phaser, any other game/physics library, or a build step of any kind.
- Server-side score validation or anti-cheat — there's no backend yet.
- "Seasonal Sports Festivals" or any rotating-season concept — a bonus idea from the research, not part of this round.
- Real (non-demo) arcade leaderboard data — still sourced from the existing demo athlete array.

---

## Acceptance Criteria

- [ ] Home Run Hero, Web Gem, and Clutch Catch all exist, are playable, and are the only three games in the Arcade grid.
- [ ] Strike Zone Challenge, the wheel, and trivia are byte-for-byte unchanged.
- [ ] All XP from all three games — including Clutch Catch — flows through the existing `awardGameXP()` function and respects the 25/day cap; total arcade XP earned in a day never exceeds 25 regardless of how many rounds are played across all three games.
- [ ] `state.arcadeMetrics` exists and is populated after play, but grep confirms it is not referenced anywhere inside `ratings()`, `pr()`, or `score()`.
- [ ] No new `<script src>` or package dependency has been added — the site still loads as three plain files with no build step.
