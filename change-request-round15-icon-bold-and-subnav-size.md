# Change Request: Icon library follow-up — mode-nav bold weight + subnav 2x size

Follow-up to Round 14 (final icon library, CSS mask system). That round shipped the 13 real vector icons via `.lua-icon` masks; this round only adjusts two things on top of it:

1. Mode-nav icons (Athlete/Team HQ/Arcade) get a heavier/bolder visual weight via an SVG `feMorphology` dilate filter, applied only to those three via a new `.icon-bold` class — subnav and home-card icons stay as-is (unbolded).
2. Subnav tab icons double from 18px to 36px, with `.subnav .tab` gap bumped from 8px to 10px and padding adjusted (`8px 16px`) so the bigger icon doesn't crowd the label.

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="icon-bold-filter" x="-25%" y="-25%" width="150%" height="150%">
    <feMorphology operator="dilate" radius="1.1"/>
  </filter>
</svg>
```
```css
.icon-bold{ filter: url(#icon-bold-filter); }
```

`radius="1.1"` is a starting guess — needs eyeballing at real size, watching that small glyphs (Player Card's stat-row detail, Skill Lab's flask lines) don't clog up and go illegible at higher radius values. Fallback if feMorphology renders inconsistently: duplicated-and-slightly-scaled pseudo-element using the same mask.

Home path card icons and layout (Section 4's first block) are unchanged from Round 14 — already shipped.

## Acceptance criteria
- Mode nav buttons show icon only (unchanged from Round 14), now visibly bolder than subnav/home-card icons.
- Subnav tabs: icon-left/text-right, vertically centered, consistent 10px gap, icons at 36×36.
- Compare bold mode-nav icons against detailed subnav icons (Player Card, Skill Lab) side-by-side to confirm the chosen dilate radius doesn't blob out fine detail.
- No hardcoded hex colors — every color reference is an existing `:root` token.
- XP totals, storage keys, parent-code gates, game/quest logic unchanged.
