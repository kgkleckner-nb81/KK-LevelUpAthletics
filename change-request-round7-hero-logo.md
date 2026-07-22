# Level Up Athletics — Change Request, Round 7: Hero Logo Placement & Treatment

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**.

**Scope:** the Home screen hero header only (`<header class="hero">` in `index.html`, styled by `.hero`, `.hero-copy`, `.hero-logo`, `.logo-stack` in `styles.css`). "The call-up path box" referenced below is `.logo-stack` / `#heroLadderPreview` — it's already captioned "CALL-UP PATH" via a CSS `:before` label, so that's confirmed to be the right element.

**Update — final logo art now in hand.** Kurt supplied the actual mark: a black icon (upward arrow inside a hexagonal/shield outline) stacked above a black "LEVEL UP" wordmark and tracked-out "ATHLETICS" subtext, already exported with a transparent background. This resolves the transparency and dual-keyline questions below — the logo is solid black with no white or blue elements, so there's nothing to selectively outline; it just needs to be placed and sized correctly.

**Action needed before this can be implemented:** the actual image file has to land at `assets/brand-logo.png` in the repo (that path is empty today). It could not be retrieved automatically from this chat session — Kurt, please drag the logo file directly into the `assets` folder (or attach it in whatever session runs this prompt) so Claude Code can reference it at that path.

---

1. **[Cosmetic]** Move the logo out of `.hero-copy` (currently sitting above the `<h1>`) and place it above `.logo-stack`/`#heroLadderPreview` on the right side, in a new wrapper containing both, stacked vertically (logo on top, "CALL-UP PATH" box below).

2. **[Cosmetic]** Increase the logo's size beyond the previously discussed 2x (`112px`) — go noticeably larger now that it's the real mark. Suggested starting point: `height:200px` (width auto, same aspect ratio) — treat as tunable once it's actually visible on the page; the goal is for it to read as a prominent brand mark next to the CALL-UP PATH box, not a small icon.

3. **[Cosmetic — resolved]** Transparent background: no work needed beyond a plain `<img>` — the source file already has alpha transparency, so it will sit directly on the hero's gradient with no box around it, no CSS tricks or SVG conversion required.

4. **[Not applicable — resolved]** No keyline treatment needed. The earlier ask (black keyline on white parts, thin keyline on blue parts) assumed a white/blue logo; this mark is solid black throughout, so there's nothing to differentiate.

5. **[Cosmetic]** Alignment: change `.hero`'s `align-items` from `center` to `flex-end`, so the left column (`.hero-copy`, ending in its descriptive paragraph) and the new right column (logo + CALL-UP PATH box) bottom-align against each other automatically. This is what achieves "the box moves down a little so its bottom lines up with the bottom of the left-side text" — let flexbox handle it via bottom-alignment rather than a manual margin/offset guess, since the exact amount depends on how tall the logo ends up being at its new size.

---

## Open Questions

1. Confirm the `height:200px` starting size in item 2, or specify a different target once it's placed and visible.
2. Within its own column, should the logo be centered above the CALL-UP PATH box, or right-aligned to match the box's right edge?
