# Level Up Athletics — Change Request, Round 5: Rating Engine, Call-Up Ladder, Team Identity

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**, **[Structural]**.

**Sequencing note:** `change-request-round3-skilllab-dailycheckin-combine.md` already requires rewriting `pr()`, `ratings()`, and `score()` to read from the new Program-based log shape instead of today's flat fields (its "Cross-Cutting Risk" section). Do that rewrite **together with** this round's scoring-model changes below, not as two separate passes over the same functions.

**Trademark note (why this round exists):** the current call-up ladder uses real team logos and names — Milwaukee Brewers, Wisconsin Timber Rattlers, Biloxi Shuckers, San Antonio Missions — and a hardcoded local team identity (`TEAM_NAME = 'Northbrook Spartans'`, `spartans-logo.png`). This round replaces all of it before beta testing with a real outside team.

**Roadmap context:** after this round, one further round is planned for the Arcade section, and then the project moves from this static/localStorage demo to real Supabase-backed authentication, login, and a shared multi-user database. Keep that in mind for anything that feels like it should "really" be a backend feature (rosters, real-time leaderboards, etc.) — build the lightest reasonable version now, and expect it to be revisited once Supabase lands.

---

## Part 1 — Rating Engine

1. **[Structural]** Rating and XP remain **fully separate systems** — do not add any XP-derived input into `ratings()`. Consistency stays as its own axis, computed from raw workout count and streak length (as today), because that's a direct fact about engagement, not a spend of XP currency.
2. **[Structural]** The four performance axes (speed, strength, power, agility) should be **dominated by verified Combine Testing results, with a small, capped contribution from self-reported Daily Check-In bests** — enough that consistent daily training visibly nudges the number week to week (motivation, retention), but not enough that self-reported numbers alone could carry an athlete meaningfully up the scale. Suggested split: roughly 80-85% of an axis score from the latest verified Combine result, the remaining 15-20% from a capped daily-logged component. This replaces the earlier "Combine-only" recommendation — daily check-ins should feel like they matter day-to-day, while the big, officially-recognized jumps still come from Combine. Daily Check-In data also continues to drive XP, streaks, PR badges on Recent Workouts, and the Consistency axis as before.
3. **[Functional]** Replace the discrete 5-tier bench lookup (`score()`/`benches`, which jumps in chunks of 8+ points) with a continuous curve — interpolate between benchmark points instead of snapping to the nearest tier, so incremental improvement always shows.
4. **[Functional]** While rebuilding `score()`, fix the apparent bug where the speed axis scores sprint *repetitions* against the push-up benchmark table (`score(r.sprints,'pushups')`) — confirm intended behavior and correct it.
5. **[Structural]** Replace the current bonus mechanism (`customExerciseLogCount(axis)*2`, capped at 15, rewarding *distinct exercises logged* regardless of performance) with a bonus tied to **measured improvement between verified Combine checkpoints** — e.g., a capped bonus (~10 points) awarded when an axis's verified PR improves from the season's first Combine checkpoint to its second (see the season timeline under Part 2). This is the main lever that makes 99 hard to reach: it requires real, verified improvement across the season rather than one-time logging variety — while still being achievable within a single ~3-month season rather than requiring multiple seasons.

---

## Part 2 — Call-Up Ladder Rename & Promotion Gates

**Season model:** progress should be visible across one typical youth-league season (~12-13 weeks), with Combine Testing at its existing recommended 6-8 week cadence giving roughly two verified checkpoints per season — call them the **Mid-Season Combine** (~Week 6) and the **End-of-Season Combine** (~Week 12). Daily Check-ins should keep the numbers feeling alive week to week (per Part 1, item 2's small capped contribution); the checkpoints are where tier promotions actually get confirmed.

6. **[Structural]** Replace the `tiers` array and all associated logo assets. New sport-agnostic, non-trademarked six-tier ladder:

   | Old | New |
   |---|---|
   | Rookie | Rookie |
   | Travel Ball | Grinder |
   | Single A | Baller |
   | Double AA | All-Star |
   | Triple AAA | Elite |
   | THE SHOW | Legend |

   Remove `brewers-logo.png`, `single-a-logo.png`, `double-aa-logo.png`, `triple-aaa-logo.png`, `little-league-logo.png` entirely. **Kurt is sourcing original badge artwork for the six tiers on a separate track — do not generate placeholder art.** Instead, build the tier badge display as a simple, swappable image slot per tier (e.g., a `tierBadges: { Rookie: 'assets/tier-rookie.png', Grinder: 'assets/tier-grinder.png', ... }` lookup, or equivalent), defaulting to a plain colored placeholder box or the existing Diamond Badge mark if no file is present yet, so real artwork can be dropped in later with zero code changes. Do not reuse the workout-program names (Base Camp/The Grind/Boss Level) for ladder tiers — keep the two naming systems distinct so athletes don't confuse "which program" with "which tier."

7. **[Cosmetic]** Style the six tier name labels (wherever they render as text — status bar, Player Card, ladder view) with a graffiti/street-art treatment: a bold urban display font rather than the existing Baloo 2/Fredoka pairing for this specific element, combined with a multi-color fill (a gradient across the existing neon palette — blue, pink, green, yellow — clipped to the text, or distinct colors per letter for a more literal spray-paint-tag look). Suggested font: **Bungee** (Google Fonts) for a bold, legible graffiti-tag feel at small UI sizes; **Permanent Marker** is a reasonable alternative if a more handwritten-marker look is preferred. Load whichever is chosen the same way the existing fonts are loaded (the `@import` at the top of `styles.css`). This treatment applies only to the tier name text, not the rest of the UI's typography.

8. **[Structural]** Promotion between tiers requires **all** of the following, not rating alone:
   - **Rating gate:** `ratings().overall` at or above the tier's threshold.
   - **Volume gate:** a minimum number of logged workouts, season-to-date.
   - **Combine confirmation gate:** the rating threshold must be confirmed at a specific verified Combine checkpoint (see table) — this is what makes Combine the primary promotion driver, not Daily Check-in.
   - **Engagement gate:** a minimum bar of platform engagement independent of rating — e.g., a streak length, or quest/battle/team-program participation — satisfied by any one of a few paths rather than a single rigid metric.

   Designed so a consistent, strong athlete can realistically climb several tiers across **one season**, while Legend is deliberately the exception — the only tier that requires proof spanning the *entire* season rather than a single checkpoint:

   | Promotion | Rating | Workouts (season-to-date) | Combine confirmation required | Engagement (any one) |
   |---|---|---|---|---|
   | Rookie → Grinder | 55 | 5 | 1st verified Combine (or early baseline check) at/above threshold | 3-day streak or 1 quest completed |
   | Grinder → Baller | 65 | 10 | Confirmed at the Mid-Season Combine | 5-day streak or 2 quests/battles |
   | Baller → All-Star | 75 | 15 | Confirmed at Mid-Season **or** End-of-Season Combine | 7-day streak, 3 quests, or team program logged |
   | All-Star → Elite | 85 | 20 | Confirmed at the End-of-Season Combine | 10-day streak, or 4 quests + team program |
   | Elite → Legend | 93 | 25 | Threshold met at **both** the Mid-Season **and** End-of-Season Combine — proof across the full season, not one good test | 14-day streak, or 5 quests + team program |

   Treat the specific numbers as tunable starting points once there's real beta data, not fixed forever — the shape of the table (increasingly strict, Legend requires two checkpoints) is the important part.

9. **[Functional]** Evaluate promotion at the two Combine checkpoints described above — i.e., re-check gates when a Mid-Season or End-of-Season verified Combine result is saved — rather than continuously recalculating on every render. This avoids an athlete's tier flickering as raw numbers shift day to day, and fits the "call-up" narrative better (a real call-up follows a review, not an instant stat change).
10. **[Functional]** Disclosure: keep showing the athlete their overall numeric rating and current tier exactly as today (this is core to the Player Card's trading-card appeal). Do **not** expose the underlying formula, axis weights, or exact gate thresholds as literal numbers. Instead, add a plain-language "Path to Next Tier" checklist — e.g., "Rating goal met ✅ / 12 of 20 workouts logged ⏳ / Awaiting End-of-Season Combine ⏳ / Engagement goal met ✅" — visible progress without exposing the internal math.

---

## Part 3 — Coach-Defined Team Identity

11. **[Structural]** Replace the hardcoded `TEAM_NAME = 'Northbrook Spartans'` constant and its logo with a coach-defined **Team** entity: `{ name, joinCode, logo? }`, set up from the Coach/Parent Corner (alongside the existing Team Program builder there). Generate a unique join code per team.
12. **[Functional]** Athletes associate with a team by entering its join code once (reuse the existing parent-code-style gated-input pattern for consistency). Until a coach configures a team, fall back to a generic default badge (not a real team's logo) rather than defaulting to Spartans branding.
13. **[Scoping note — confirm before building]** On the current single-athlete, localStorage-based architecture, "joining a team" only ever affects the one athlete on that browser/device — there's no shared roster of real teammates yet. This change de-hardcodes the team's *identity* (name/logo/code) so a different real beta team isn't stuck seeing Spartans branding; an actual shared multi-athlete roster requires the Supabase migration already discussed separately (see Roadmap context at top). Build this round's team-identity change on the current stack; don't block it on Supabase.

---

## Open Questions

1. The rating thresholds and promotion-gate numbers in the table under item 8 are starting recommendations, not final — confirm you're comfortable shipping with these and tuning later, or specify different starting values now.
2. The season model assumes ~12-13 weeks with two Combine checkpoints (Week 6 / Week 12) — confirm this matches the actual league season length you're targeting for beta, since the whole promotion table is built around that timeline.
3. Graffiti font choice (item 7) — confirm Bungee vs. Permanent Marker, or provide a different preference.
