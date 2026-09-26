# Level Up Athletics — Change Request, Round 16: Coach HQ Nav Placeholder + Coach/Parent Corner → Settings Rename

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**, **[Structural]**.

**Context:** implements Step 0 from `coach-hq-schema-and-roadmap.md` (see that doc for the full schema and rollout roadmap this is scoped against). Two changes bundled together because they touch the same nav markup:

1. Add a Coach HQ nav tile + mode button + a static "coming soon" placeholder screen — no backend, no data model, open to anyone (not gated by `isCoach` yet).
2. Rename the visible "Coach/Parent Corner" label to "Settings" in the two places it appears as text.

---

## The change

1. **[Structural]** Add a 4th path-card to the home `.path-grid` (`index.html`), `coachhq-path`, positioned between `team-path` and `arcade-path`. Same markup pattern as the other three (`h3`, `p`, `ul`, `<span>ENTER … →</span>`), wired automatically by the existing generic `$$('[data-path]').forEach(...)` handler in `app.js` — no new per-tile JS needed.
2. **[Structural]** Add a `coachhq` mode button to `.mode-nav`, positioned between the Team HQ and Arcade buttons, matching the recommendation in `coach-hq-schema-and-roadmap.md`.
3. **[Structural]** Add a new `#coachhq` screen (static content covering the four buckets from the roadmap doc — drills, coaching approach, lesson plans, skill videos — each framed as "coming soon") and a matching `#coachhqSubnav` (single-tab pattern, same as `#arcadeSubnav`).
4. **[Functional]** Wire the new mode into `app.js`: `modeForScreen('coachhq')` → `'coachhq'`, add `'coachhq'` to the subnav-toggle list in `showModeNav`, and `enterMode('coachhq')` → `switchScreen('coachhq')`.
5. **[Cosmetic]** `.path-grid` goes from 3 to 4 columns (desktop); `.mode-nav` goes from 5 to 6 buttons (desktop) and from 4 to 5 visible on mobile (`Settings`/`.parent-mode` stays hidden on mobile — unchanged behavior). `coachhq-path` uses a `--deep-blue` → `--neon-blue` gradient — existing tokens only, no new hex values (Round 15's own rule).
6. **[Cosmetic]** Rename the visible text "Coach/Parent Corner" → "Settings" in the two places it's shown: the `.mode-btn.parent-mode` button label and the `#parentSubnav` tab label. All internal ids/attributes (`data-mode="parent"`, `id="parent"`, `#parentSubnav`, every `mode==='parent'` / `id==='parent'` reference in `app.js`) are unchanged — this is a label-only rename so it doesn't ripple through working code paths.

---

## Open Questions

1. **Coach HQ icon art:** every other mode-nav button (Athlete/Team/Arcade) uses a real hand-illustrated icon from the `.lua-icon` mask system (Round 14). There's no matching `LUA_Coach.svg` yet, and the existing icons are Illustrator-quality vector art that a rough hand-drawn substitute wouldn't match. This round ships the Coach HQ mode button as **text-only** — same treatment as Settings/`.parent-mode`, which is already text-only and already established as visually distinct from the icon buttons — rather than fake a mismatched icon. Swapping in a real `LUA_Coach.svg` mask icon later is a small, isolated change whenever one exists. Same reasoning applies to the path-card: instead of an icon in the `.path-icon` slot, the card uses a small "COMING SOON" corner ribbon (CSS only, existing tokens) so the unfinished state reads as honestly unfinished rather than papered over with mismatched art.
2. **Coach Tools migration:** not part of this round — whether the existing `data-coach-only` "Coach Tools" block (team setup/roster/program/challenges, currently inside Settings) eventually moves into the new Coach HQ tile is explicitly deferred in `coach-hq-schema-and-roadmap.md`, not a Step-0 decision.
