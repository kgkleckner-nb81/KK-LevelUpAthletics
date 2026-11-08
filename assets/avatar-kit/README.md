# Avatar kit layers

Transparent 900x1200 renders of the creator's final model (NORTH14_Final.blend, revision 2026-11-02), in two poses.
Stacking them in order gives the full-body avatar. `avatar-kit.js` does the stacking.

- **Ready stance:** this folder. Front camera.
- **Hands on hips:** `pose-hips/`. Camera turned 25 degrees to the side, lights turned with it.
- **Camera:** orthographic, 2.45 m frame centered at z = 0.805 m (feet about 17% above the bottom edge, leaving room for the Player Card name plate).
- **Render:** Eevee, 32 samples, transparent film, Standard view transform, exposure -0.55, three sun lights.
- **Palettes:** A = light skin, brown hair, blue eyes. B = deep skin, black hair, green eyes. Team colors: green, royal blue.
- **Body is a holdout** when rendering clothing, hair and cap layers, so parts that would sit behind the body are hidden. For the garment layers the holdout body is shrunk by 12 mm, because the final model's garments fit tightly and would otherwise be cut. The body layer has the feet masked because the shoes cover them.

Stack order (bottom to top): `body_{A|B}`, `shoes_{team}`, then `bottom_baseball` + `top_baseball_{team}` or `basketball_{team}`, then `hair_{A|B}_{classic|cap}` (cap version when a cap is worn), then `cap_{team}`, then `glasses_neon` when worn.

Re-render with `tools/avatar-kit/render_final_layers.py` (usage in its header), then bump `AV_VER` in `avatar-kit.js` so browsers do not mix old and new cached layers.

Open points: the cap crest is the creator's placeholder artwork and its usage rights are still to be confirmed. The basketball shorts use the model's default grey. The creator's Round 3 revisions will need another render.
