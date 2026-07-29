# Change Request: Swap in the final icon library (real vector files) + hover/click states + layout

Supersedes the icon portion of `change-request-round10-icon-system.md`. Round 10 hand-built an inline SVG sprite as a stand-in. We now have final vector files for every icon, so this round replaces that sprite entirely and adds interaction states and per-placement layout rules. XP/storage/parent-code/game-logic constraints from prior rounds still apply — this is still a visual-only change.

## 0. Source files

13 finished icons, exported from Illustrator, copied from `~/Desktop/Claude Projects/LUA Icons/` into `assets/icons/*.svg` (filenames kept as-is): LUA_Athlete.svg, LUA_Team.svg, LUA_Arcade.svg, LUA_Clubhouse.svg, LUA_Daily-Check-In.svg, LUA_Weekly-Combine.svg, LUA_Player-Card.svg, LUA_Skill-Lab.svg, LUA_Quests.svg, LUA_Battles.svg, LUA_Rewards.svg, LUA_Leaderboards.svg, LUA_Stats-Charts.svg.

3 extra reference mockup files (LUA_Style-Primary.svg, LUA_Style-Hover Active.svg, LUA_Style Success-Unlocked.svg) are NOT wired in directly — Section 3's CSS color changes achieve the same primary/hover/active intent across all 13 icons systematically.

Each SVG is a single solid-fill silhouette (no gradients, no embedded raster).

## 1. Why masking instead of inline `<symbol>`

CSS mask technique: reference each file as a CSS mask, paint with `background-color`/`color`. Recoloring (including hover/active) becomes a plain CSS `color` change.

```css
.lua-icon{
  display:inline-block;
  background-color: currentColor;
  -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
  -webkit-mask-position:center;  mask-position:center;
  -webkit-mask-size:contain;     mask-size:contain;
  vertical-align:middle;
  flex:none;
}
.icon-athlete       { mask-image:url('assets/icons/LUA_Athlete.svg'); }
.icon-team          { mask-image:url('assets/icons/LUA_Team.svg'); }
.icon-arcade        { mask-image:url('assets/icons/LUA_Arcade.svg'); }
.icon-clubhouse     { mask-image:url('assets/icons/LUA_Clubhouse.svg'); }
.icon-daily-checkin { mask-image:url('assets/icons/LUA_Daily-Check-In.svg'); }
.icon-combine       { mask-image:url('assets/icons/LUA_Weekly-Combine.svg'); }
.icon-player-card   { mask-image:url('assets/icons/LUA_Player-Card.svg'); }
.icon-skill-lab     { mask-image:url('assets/icons/LUA_Skill-Lab.svg'); }
.icon-quests        { mask-image:url('assets/icons/LUA_Quests.svg'); }
.icon-battles       { mask-image:url('assets/icons/LUA_Battles.svg'); }
.icon-rewards       { mask-image:url('assets/icons/LUA_Rewards.svg'); }
.icon-leaderboards  { mask-image:url('assets/icons/LUA_Leaderboards.svg'); }
.icon-stats-charts  { mask-image:url('assets/icons/LUA_Stats-Charts.svg'); }
```

Usage: `<span class="lua-icon icon-clubhouse" aria-hidden="true"></span>`.

## 2. Where each icon goes (unchanged from round 10)

Home path cards → icon-athlete / icon-team / icon-arcade. Mode nav → same three + Coach/Parent Corner (no icon, leave as text). Athlete subnav → icon-clubhouse, icon-daily-checkin, icon-combine (Combine Testing), icon-player-card, icon-skill-lab, icon-quests (Quests & Battles tab; icon-battles next to in-screen "Boss Battles" heading only), icon-stats-charts (Progress), icon-rewards (Reward Locker). Team HQ subnav → icon-team (Team Dashboard), icon-leaderboards (League HQ).

## 3. Color states — default / hover / click

Reuse existing `:root` tokens only, no new hex.

Mode nav (sits on var(--ink)):
```css
.mode-btn .lua-icon{color:var(--neon-blue)}
.mode-btn:hover .lua-icon{filter:drop-shadow(0 0 6px rgba(0,229,255,.75))}
.mode-btn.active .lua-icon{color:var(--ink)}
```

Subnav tabs (pill defaults to var(--ink) bg / white text):
```css
.subnav .tab .lua-icon{color:var(--paper)}
.subnav .tab:hover .lua-icon{color:var(--neon-blue)}
.subnav .tab.active .lua-icon{color:var(--ink)}
```

Home path cards:
```css
.path-card .lua-icon{color:var(--paper)}
.path-card:hover .lua-icon{filter:drop-shadow(0 4px 10px rgba(0,0,0,.4))}
```

Reward/Quest cards keep is-unlocked treatment (swap to var(--neon-green) / #1FA35C on .reward-tile.unlocked / .quest-card.complete).

## 4. Layout per placement

Home path cards: same 130x130 footprint as current placeholder.

Mode nav: icon-only, 34px, remove visible text label, keep aria-label. `.mode-btn{display:flex;align-items:center;justify-content:center;padding:12px 10px!important}`.

Subnav tabs: icon-left (18px) + text-right, `.subnav .tab{display:flex;align-items:center;gap:8px}`.

## 5. Acceptance criteria

- All 13 assets/icons/*.svg unmodified from source.
- No `<img>` tags for these icons — all use .lua-icon mask component.
- Home path card icons same size as current placeholder (no shrinkage).
- Mode nav buttons icon-only, aria-label matching removed text.
- Subnav tabs icon-left/text-right, vertically centered, consistent 8px gap.
- Hover/active states per Section 3; active tab uses ink-on-color contrast, not blue-on-color.
- No hardcoded hex colors — every color is an existing :root token.
- XP totals, storage keys, parent-code gates, game/quest logic unchanged.
