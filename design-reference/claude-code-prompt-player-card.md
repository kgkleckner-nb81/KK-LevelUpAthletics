# Claude Code prompt — Player Card page update

Copy everything in the code block below into Claude Code. Before running it, copy `player-card-page.html` and the `cards/` image folder into your repo (anywhere Claude Code can read them, e.g. a `design-reference/` folder) so it has the reference implementation and sample images available.

```
I'm updating the player card avatar section of my site to match a new layout and behavior. Before changing anything, explore the repo to find the existing player card page/component and match our current framework, styling system, and component conventions — don't introduce a new stack or styling approach.

There's a working HTML/CSS/JS prototype at design-reference/player-card-page.html (with sample images in design-reference/cards/) that shows the exact layout and interaction I want. Use it as the design and behavior reference, but rebuild it properly within our actual component structure — don't just copy-paste the raw HTML.

Requirements:

1. Single cohesive panel (not visually split into separate boxes) containing:
   - Top row: a prominent player card image, positioned top-left, roughly 3:4 portrait aspect ratio, with a bordered/glowing frame.
   - To the right of the card: athlete Name, Team, Overall Ranking (big stat/grade), and Call Up Level (tier/badge), plus a "Build Your Athlete" call-to-action button.
   - Below the card + info row, still inside the same panel: a grid of player ratings (e.g. Speed, Power, Accuracy, Agility, Endurance, Game IQ — keep these sport-agnostic), each shown as a label + horizontal color-coded meter bar (red/amber/blue/green by value tier) + numeric value.

2. Rotating card images: the player card image area should automatically cycle through a set of sample images, one every 3.5 seconds, with a smooth crossfade (not a hard cut). Add small dot indicators below the card showing which image is active. Pause rotation on hover/focus, and respect prefers-reduced-motion (disable or slow the auto-rotation/fade for users who have that set).

3. "Build Your Athlete" button: make it a prominent primary CTA. It doesn't need a real destination yet — wire it to a placeholder route/handler (e.g. a stub function or route like buildYourAthlete / /build-your-athlete with a TODO comment) that will later lead to a flow for taking a selfie, rendering a 3D avatar, and opening a reward locker to purchase avatar attributes/skins.

4. Don't hardcode the athlete data inline — pull name, team, overall ranking, call-up level, and ratings from props/a config object/whatever data pattern the rest of the app already uses, so the component is reusable per athlete.

5. Use the 4 sample images in design-reference/cards/ as the placeholder rotation content for now — move them into the appropriate assets folder for this component.

6. Make the layout responsive — stack the card and info column vertically on narrow/mobile viewports, and keep the ratings grid readable at one column on mobile.

Start by showing me the current player card implementation and your plan before making changes.
```
