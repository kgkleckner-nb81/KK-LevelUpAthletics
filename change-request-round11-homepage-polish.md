# Level Up Athletics — Change Request, Round 11: Homepage Polish & Ladder Fix

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**.

**Scope:** four small, unrelated aesthetic fixes — hero copy, team logo tile centering, footer text, and one Call-Up Ladder card. No behavior/logic changes anywhere in this round.

---

1. **[Cosmetic]** Replace the hero subhead in `index.html` (`<p>Daily baseball training with a Rookie-to-Legend progression, player ratings, parent-approved combine tests, badges, and charts.</p>`) with a sport-agnostic, more motivating line. Keep the existing `<h1>Train. Level Up. Get Called Up.</h1>` as-is — only the paragraph beneath it changes. Pick one of these (or use as a starting point) — see Open Questions:

   - *"Every workout is a level up. Climb from Rookie to Legend, build your Player Card, squad up with your team, and battle it out in the Arcade."*
   - *"Turn practice into progress you can see — rank up from Rookie to Legend, log your training, and take on your squad in the Arcade."*
   - *"Train daily. Rank up from Rookie to Legend. Squad up with your team and battle it out in the Arcade — getting better should feel like a game."*

2. **[Cosmetic]** The team logo on the home path-grid ("TEAM HQ" tile) isn't centered. Root cause: `#pathCardTeamLogo` is a `<div>` wrapper around the `<img class="team-logo team-logo-path">` (or the fallback initial box), and `.path-card img{align-self:center}` only affects direct `<img>` flex children — it does nothing for the wrapper `<div>`, which inherits `.path-card`'s `align-items:flex-start` and sits left-aligned. Fix by centering the wrapper itself, e.g. `#pathCardTeamLogo{align-self:center;display:flex;justify-content:center;width:100%}`, not by re-tweaking the image's own CSS (which is already centered relative to a wrapper that itself isn't).
3. **[Cosmetic]** Remove the trailing `⚾` from the footer line in `index.html`: `<p>Play fast. Have fun. Get a little better every day. ⚾</p>` → drop the emoji, keep the text.
4. **[Cosmetic]** The Rookie card in the Clubhouse Call-Up Ladder (`#tier0`, the first card rendered by `renderLadder()`) shows a thin margin of the badge's own background around its edge instead of sitting full-bleed like the other five cards — even though all six cards share the same `.tier.cardtier .logo-frame img{object-fit:cover}` rule. This points to the Rookie source badge (`assets/tier-rookie.png`) having proportionally more transparent margin around its circular artwork than the shield-shaped Grinder/Baller/etc. badges have around theirs, so "cover" isn't cropping quite enough of it away. Two-step fix: first try a small `#tier0 .logo-frame img{transform:scale(1.12)}`-style zoom (same targeted-per-card approach already used for the Elite/Legend size bump in Round 6's CSS) to crop the visible margin out. If that still leaves a visible edge at normal card size, the badge PNG itself needs a tighter crop at the source (regenerating/re-exporting `tier-rookie.png` with less internal padding) — flag back rather than fighting it further in CSS.

---

## Open Questions

1. Pick one of the three tagline options in item 1, or provide your own direction/edits.

---

## Acceptance Criteria

- [ ] Hero subhead no longer mentions baseball specifically.
- [ ] Team logo (or fallback initial box) on the TEAM HQ tile is horizontally centered, matching the Arcade/Athlete tiles' icon alignment.
- [ ] Footer reads "Play fast. Have fun. Get a little better every day." with no trailing icon.
- [ ] All six Call-Up Ladder cards, including Rookie, read as visually full-bleed with no edge gap.
- [ ] No other ladder card's sizing/positioning regresses as a side effect of the Rookie-specific fix.
