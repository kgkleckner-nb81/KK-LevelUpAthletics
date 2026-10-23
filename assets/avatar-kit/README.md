# Avatar kit layers (proof of concept)

Transparent 900 x 1200 WebP layers rendered from `NORTH14_Final.blend`. Every layer uses the same
camera and pose, so stacking them in order gives the full-body avatar.

- **Camera:** orthographic, front view, frame 2.45 m tall, centered at z = 0.805 m (feet about 17% above the bottom edge, leaving room for the Player Card name plate).
- **Pose:** `Pose_Athletic_Ready`, frame 1. **Render:** Eevee, 32 samples, transparent film, Standard view transform, exposure -0.55, three sun lights.
- **Palettes:** A = light skin, brown hair, blue eyes. B = deep skin, black hair, green eyes. Team colors: green, royal blue.
- **Body is a holdout** when rendering the clothing, hair and cap layers, so parts that would sit behind the body (the back of the hair, the inside of a jersey) are hidden. The body layer has the feet masked because the shoes cover them.

Stack order (bottom to top): `body_{A|B}`, `shoes_{team}`, then `bottom_baseball` + `top_baseball_{team}` or `basketball_{team}`, then `hair_{A|B}_{classic|cap}` (cap version when a cap is worn), then `cap_{team}`.

The cap crest is the creator's placeholder artwork and its usage rights are still to be confirmed. Known art defects in these layers (hip patches and ragged hems on the basketball shorts, ankle tabs, hair edges, cap shape) come from the source file and are on the creator's revision list.
