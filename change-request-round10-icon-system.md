# Change Request: Icon System (SVG, dual-background, corrected palette)

## Goal
Replace the emoji/text used for primary navigation (Home path cards, the Athlete/Team HQ/Arcade/Coach-Parent Corner mode nav, and the Athlete + Team HQ subnav tabs) with a proper SVG icon system. Do not touch game emoji inside the Arcade mini-games, reactions, or the streak/pack-status glyphs in the status bar — those are out of scope.

This is a visual-only change. Do not alter XP calculations, storage keys, parent-code workflow, combine verification, quest/battle logic, or Reward Vault logic (same constraint the visual-refresh rounds have followed).

## Why
The icon set was drafted against a generic dark/neon mockup and used off-brand hex values (`#00B2FF`, `#39FF6A`) that are close to, but not equal to, this site's real tokens (`--neon-blue:#00E5FF`, `--neon-green:#39FF88`). It also assumed a solid black background everywhere, but most of the app is on `--cream` / `--paper` cards with `--ink` borders — only the status bar, mode nav, Arcade section, footer, and League "drop" cards are true dark. So the icon set needs two variants, not one, and needs to use the exact existing tokens rather than new ones.

(Full sprite markup, CSS, placement table, usage pattern, and acceptance criteria as provided in chat.)
