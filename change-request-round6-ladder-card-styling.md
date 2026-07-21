# Level Up Athletics — Change Request, Round 6: Call-Up Ladder Card Styling

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**.

**Scope:** the Clubhouse "Call-Up Ladder" card only (`renderLadder()` in `app.js`, rendering into `#ladderContainer`, styled by `.tier.cardtier` and related rules in `styles.css`). No behavior/logic changes — this is purely the six tier cards' visual treatment.

---

1. **[Cosmetic]** Change the base card background from white (`var(--white)`) to black (`var(--ink)`) on `.tier.cardtier`. Keep the card's shadow, rounded corners, and the "CALL UP" corner tag as-is.

2. **[Cosmetic]** Keep the existing highlighted treatment for the athlete's current tier exactly as built — `.tier.cardtier.active` already gives it a neon-blue border, glow, and slight scale-up. Since the base card background is going black, the *non-active* cards need their own distinct border color (today they're a plain black border, which would be invisible against a black card). Recommend a warm neutral — cream or peach — for non-active card borders, so the contrast reads clearly: warm/muted border = tier not yet reached, glowing neon-blue border = current tier. Treat the exact color as adjustable — see Open Questions.

3. **[Cosmetic]** Remove the bottom tier-name banner entirely — both the `<span class="tier-name-graffiti">${t.name.toUpperCase()}</span>` in `renderLadder()`'s template and its associated banner CSS (`.tier.cardtier span`, the black strip with the neon-blue top border). The incoming badge artwork already carries the tier name as part of the image (per the image-generation prompt), so this text becomes redundant. **Scope note:** only remove the name text from the ladder cards specifically — the `.tier-name-graffiti` class is also used for tier-name text in the status bar and Player Card; leave those untouched, since they're separate render locations that happen to share the same CSS class.

4. **[Cosmetic]** Make the badge image full-bleed within each card now that the bottom banner is gone: remove `.logo-frame`'s padding and min-height, and remove the per-card `nth-child` image size overrides (they were compensating for the old real logos' inconsistent aspect ratios — unnecessary once the new badge art shares one consistent shape). Set the image to fill the full card (`width:100%; height:100%; object-fit:cover`) — the card's existing `overflow:hidden` already keeps this cropped to the rounded corners.

5. **[Cosmetic — recommendation, confirm]** Keep the "CALL UP" corner tag as a small overlay chip on top of the full-bleed image — it has its own dark background chip so it should stay legible over any artwork. Recommend dropping the dashed inner-border decoration (`.tier.cardtier::after`), since it was a subtle detail meant for a plain white card background and won't read well over full-bleed art. Confirm before removing — see Open Questions.

6. **[No code change needed — reference only]** Kurt is attaching six real badge image files (Rookie, Grinder, Baller, All-Star, Elite, Legend). Once provided, save them to the exact paths already wired in `tierBadges` (`app.js`, near the top): `assets/tier-rookie.png`, `assets/tier-grinder.png`, `assets/tier-baller.png`, `assets/tier-allstar.png`, `assets/tier-elite.png`, `assets/tier-legend.png`. Nothing else needs to change — `tierBadgeHTML()` already falls back to a plain colored initial-letter box for any tier missing a file, so this can be done incrementally, one badge at a time, with zero further code changes.

---

## Open Questions

1. Non-active card border color (item 2) — confirm cream/peach, or specify a different color from the palette.
2. Confirm it's OK to drop the dashed inner-border decoration (item 5) along with the bottom banner, or keep it as an overlay on the full-bleed image.
