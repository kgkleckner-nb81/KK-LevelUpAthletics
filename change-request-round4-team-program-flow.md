# Level Up Athletics — Change Request, Round 4: Team Program Completion Flow

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**, **[Structural]**.

**Dependency:** this assumes the Team Program Check-In block on Daily Check-In (from `change-request-round3-skilllab-dailycheckin-combine.md`, item 15) exists or is being built alongside this — the button change described below routes the athlete to that block, so there needs to be somewhere to land.

---

## The change

Today, the Clubhouse Team Program card (`#teamProgramCard`, shown when `state.teamProgramOptIn` is true and a team program exists) displays the program title and an activity checklist, with a "Complete Team Program" button. Clicking it calls `completeTeamProgram()`, which **immediately** awards 50 XP (a `state.bonuses` entry with `type:'Team Program'`) with no data entry at all — it's a single click, no verification of actual effort.

That instant-award behavior goes away. The new flow:

1. **[Functional]** Clicking the Clubhouse button no longer calls `completeTeamProgram()` directly. Instead, it navigates to Daily Check-In (reuse the existing `switchScreen('daily')`) and brings the Team Program Check-In block into view — scroll it into focus (and consider a brief highlight/pulse so the athlete immediately sees where to go on a page that also has their personal program fields).
2. **[Functional]** The athlete enters results for each exercise in the Team Program block (same reps-or-time + Add Set pattern as the rest of Daily Check-In), then clicks Save.
3. **[Structural]** The 50 XP award moves from the Clubhouse button click to the **Team Program save action** on Daily Check-In. Only saving actual logged results triggers the award — clicking through from Clubhouse no longer grants anything by itself.
4. **[Functional]** Keep today's once-per-day gate, just re-anchored to the new trigger point: once a Team Program entry has been saved for the current date, saving again the same day shouldn't re-award the XP. `renderClubhouseTeamProgram()` already disables the Clubhouse button and relabels it "Completed Today" once `state.bonuses` has a same-day `type:'Team Program'` entry — keep that exact display logic; it just now reflects "already saved via Daily Check-In today" instead of "already clicked on Clubhouse today."
5. **[Cosmetic]** Recommend renaming the Clubhouse button from "Complete Team Program" to something that signals it's a jump-off point rather than a completion — e.g., "Log Team Program" or "Enter Today's Results" — so athletes don't think they've finished (and earned XP) the moment they click it on Clubhouse.

---

## Open Questions

1. **Partial completion:** does saving the Team Program block with only some of its exercises filled in still count as "completed" for the 50 XP, or does every listed exercise need a logged value first? Not specified — needs a decision before the award-gating condition can be written precisely.
2. **Save button scope:** Round 3 left open whether the Team Program Check-In block has its own dedicated Save button, or shares one combined "Save Workout" action with the personal-program fields on the same screen (round3 Open Question 3). That decision determines whether the 50 XP check triggers off a distinct save event or off "did this save include team program values" — resolve alongside that round-3 question, since this feature depends on it directly.
