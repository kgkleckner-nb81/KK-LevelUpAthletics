# Coach HQ — schema, roadmap, and nav placement

Planning doc for a future "Coach HQ" section, pulled over from the Claude project
where this was originally scoped (that project tracked LevelUpAthletics as a whole,
not just this repo). Written against this repo's actual current state — an earlier
draft of this doc was written against the wrong codebase (a friend's separate
baseball-only prototype) and got some of the current-state claims wrong; this
version corrects that and reflects what's actually here.

## What already exists in this repo today (read before building anything)

**Coach/Parent Corner** (`#parent` screen, reached via the `parent` mode) already
mixes two different things, not one:

1. **Parent admin** — Approval PIN, Parent Bonus XP, Review Pending Combine Tests.
   Settings a parent touches occasionally, gated by the PIN (not a login).
2. **Coach Tools** — Team Setup (create team + join code), Join a League, Pending
   Team Join Requests, Team Roster, Build the Team Program, Set a Team Challenge.
   All wrapped in `<div data-coach-only>`, shown/hidden in JS by one boolean:
   `$$('[data-coach-only]').forEach(el=>el.classList.toggle('hidden',!isCoach))`
   (`app.js` ~line 2579). This is real, working coach administration — team
   creation, roster, join-code approval, assigning a training program, setting a
   team-wide XP challenge. It is **not** what this doc is about.

**What does not exist yet, anywhere in the app**: a practice-drill library, a
coaching-approach/playbook layer (how to talk to a kid who just struck out, praise
ratios, age-appropriate expectations), per-kid lesson plans built from how that kid
says they want to be coached, or instructional skill-breakdown videos. That's the
gap this doc is actually about — call it **Coach HQ** to distinguish it from the
existing "Coach Tools" administration.

So there's a real three-way split once Coach HQ exists:
- Parent admin (PIN, bonus XP, approve tests) — stays in Coach/Parent Corner.
- Coach Tools (team setup, roster, program, challenges) — currently in
  Coach/Parent Corner; whether it moves to the new Coach HQ tile later is an open
  question (see below), not something to decide by default.
- Coach HQ (new) — drills, coaching approach, lesson plans, videos.

## Where the idea came from

A friend (jallen-ai on GitHub) built a separate, baseball-only prototype scoped to
exactly this gap — a "coach" section at https://jallen-ai.github.io/Baseball-HQ/coach/
(repo: https://github.com/jallen-ai/Baseball-HQ, `coach/` folder). That prototype is
not this codebase and doesn't share a design system with it, but its **content
model** is a real, fairly complete first pass worth reusing:

- `coach/PRODUCT_BRIEF.md` — personas (the volunteer parent-coach who knows the
  sport but has never coached is the primary one), jobs-to-be-done, a riskiest-
  assumptions list, a P0/P1/P2 cut. The core thesis: the coach is the
  highest-leverage point in a kid's sports experience, and the goal is to raise the
  floor of coaching quality with tooling, not certification.
- `coach/data.js` — the actual content layer: a drill library (26 entries) tagged
  by skill/age/duration with coaching cues and both a harder ("push") and easier
  ("gentle") variant of each drill; a 12-card coaching playbook (stations beat
  lines, the 5:1 praise-to-correction rule, one cue at a time, handling a
  meltdown, reading how a kid wants to be coached, running a huddle, and more);
  age-band guides (what a kid can/can't do, attention span, session shape); and a
  skill-demo pattern (an original animated checkpoint breakdown paired with a
  real linked video) built out for one skill (throwing mechanics) as the template
  for the rest.

## Draft content schema (generalized for this app's multi-sport, real design system)

Content-only — none of this needs a new backend table on day one; it can ship as
static JS data (matching how `data.js` already works in this repo) and move to
Supabase later if it needs to be coach-editable.

```
sport        { id, label }                          // this app already spans multiple sports
skill        { id, sport, label, group }             // per-sport taxonomy, same idea as Skill Lab
motivation   { id, label, kidText, coachText, sayExamples[], avoid }   // sport-agnostic
ageGuide     { id, sport, label, ages, attention, sessionLength,
               canDo[], notYet[], practiceShape[], parentNotes[], donts[], oneThing }
drill        { id, sport, name, skills[], ages[min,max], minutes, group(small|any|team),
               setup, cues[], twist, push, gentle }
homeMission  { id, sport, skill, name, need, reps, how, cue, videoQuery, xp }  // feeds existing XP engine
playbookCard { id, tag, title, hook, body[], tryThis }   // sport-agnostic coaching-approach content
skillDemo    { id, sport, skill, title, intro, phases[{label,cue,detail,mistake,sayThis}] }
video        { id, sport, skill, source(yt|licensed), title, by, minutes, why, primary }
```

`player`/`team`/`coachProfile` data doesn't need to be re-invented — this repo
already has athletes, teams, `isCoach`, join codes, and a roster (see Supabase
migrations, esp. `0014_coach_approval.sql`). Coach HQ content hangs off the
existing team/athlete rows rather than a parallel data model.

## Where Coach HQ lives in the nav

The home screen (`#home`) has a 3-tile `path-grid` today: Athlete / Team HQ /
Arcade, plus the separate `Coach/Parent Corner` mode button in the top nav
(text-only, no icon — visually already distinct from the icon-only Athlete/Team/
Arcade buttons). Recommendation, matching what was agreed before the repo mix-up
was caught:

- **Add a 4th path-card**, `coachhq-path`, between Team HQ and Arcade — same
  `path-card`/`data-path` pattern as the other three, using existing `:root`
  tokens for its gradient (no new hex values — Round 15's own rule). `--deep-blue`
  → `--neon-blue` is untouched by the other three cards and reads as "the pro/
  coach one" against Athlete's dark card, Team HQ's pink/creamsicle, and Arcade's
  purple.
- **Add a `coachhq` mode button** to `.mode-nav`, icon-style like Athlete/Team/
  Arcade (needs a new `LUA_Coach.svg` in `assets/icons/` following the existing
  `LUA_*.svg` + `.lua-icon` mask-class pattern from Round 14, or a placeholder
  glyph until one's drawn).
- **Coach/Parent Corner stays exactly where it is** — this is additive, not a
  restructuring of what already works.
- **Open question, not decided here**: does "Coach Tools" (team setup/roster/
  program/challenges) eventually move out of Coach/Parent Corner into the new
  Coach HQ tile, so Coach HQ becomes the one coach destination and Coach/Parent
  Corner becomes purely parent-admin? That's a bigger reshuffle than adding a
  tile and shouldn't happen as a side effect of Step 0.

## Suggested rollout phasing

- **Step 0 — nav placeholder**: add the tile + nav button + a static "coming
  soon" screen (four content buckets: drills, coaching approach, lesson plans,
  skill videos) behind it. No data model, no `isCoach` gating needed yet — it's
  static content, open to anyone, same as the other placeholder screens would be
  before they had data. Settles the IA question once, so nothing needs touching
  again when real content ships.
- **P0**: port the drill library, playbook, and age guides for this app's first
  pilot sport; gate the real Coach HQ content behind `isCoach` (the mechanism
  already exists — reuse it, don't build a second one); per-kid lesson plans
  built from existing athlete data plus a motivation-style field (new).
- **P1**: skill-demo videos (animated breakdown + real video, starting with one
  skill per sport as the template), team feed tie-in, coach XP tied to the
  existing XP engine.
- **P2**: season-arc planning, a real drill video library, in-game tracking,
  full multi-sport content, and the "does Coach Tools move into Coach HQ"
  question above, once there's real usage to make that call from.

## Sources
- This repo: https://github.com/kgkleckner-nb81/KK-LevelUpAthletics
- Content model reused from: https://github.com/jallen-ai/Baseball-HQ (`coach/`
  folder — `PRODUCT_BRIEF.md`, `data.js`)
- Live reference for that prototype: https://jallen-ai.github.io/Baseball-HQ/coach/
