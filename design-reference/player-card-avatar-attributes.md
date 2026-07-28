# Player Card Avatar — Attribute & Customization Taxonomy

Sport-agnostic system for LevelUpAthletics. Every attribute below is a swappable "slot" — the goal is a base avatar plus independent layers so any combination can be assembled without hand-drawing every permutation.

## 1. Sport / base character

- Sport selection: baseball, basketball, football, soccer, golf, tennis, hockey, volleyball, track & field, swimming, wrestling, lacrosse, softball, gymnastics, generic/multi-sport
- Base pose per sport (batting stance, dribble, swing, ready-position, generic athletic stance)
- Skin tone options
- Body build (keep this simple/neutral for a youth product — avoid anything that reads as body-shaming or overly adult)

## 2. Jersey / uniform

- Team primary/secondary/accent colors
- Jersey number
- Pattern (solid, stripes, gradient, camo, stars)
- Sleeve/collar style
- Team logo placement

## 3. Headwear & hair

- Sport-specific headwear: batting helmet, football helmet, cap, visor, headband
- Hairstyle + hair color
- Inclusive options: hijab, durag, braids, etc.

## 4. Gear & props (sport-specific equipment)

- Baseball: bat, glove, batting helmet
- Basketball: ball, wristbands, high-tops
- Football: helmet, shoulder pads, football
- Golf: club, bag, visor
- Soccer: ball, shin guards, cleats
- Cross-sport generic: sweatband, mouthguard, sunglasses, gloves, socks/sleeve style

## 5. Card frame / border

- Border style tiers: rookie, starter, veteran, all-star, holographic/foil
- Corner shape: rounded vs. sharp
- Material look: matte, metallic/chrome, glass, wood-grain
- Team-color theming on the border itself

## 6. Background

- Solid color / gradient
- Stadium, arena, court, field, course — sport-matched
- Abstract energy/motion-burst patterns
- Time-of-day/weather variants: sunset game, stadium lights, snow, rain
- Setting variant: game day vs. practice/training

## 7. Rarity & achievement layer (gamification)

- Rarity tiers: Common / Rare / Epic / Legendary / MVP
- Visual tags/ribbons: "Rookie of the Month," "All-Star," "Team Captain," "Most Improved"
- Foil shimmer or animated glow for top tiers
- Badge/sticker overlays: medal icons, streak flames, star counts
- Border particle effects tied to tier

## 8. Unique skins (cosmetic unlocks / rewards)

- Animal mascot heads: lizard, panda, grizzly bear, shark, eagle, lion, wolf, gorilla
- Costume skins: superhero, robot/mech, ninja, pirate, astronaut, knight, viking
- Seasonal/limited-time skins: holiday, Halloween, back-to-school, national holidays
- Color-swap skins: neon, chrome, glow-in-the-dark, camo
- Full mascot-suit mode (replaces default body entirely)

## 9. Expression / emotion

- Facial expression variants: focused, celebrating, determined, laughing, game-face
- (Later) micro-expression animation if the avatar becomes animated/3D

## 10. Stat & identity overlay (data-driven, not purely cosmetic)

- Name plate
- Position / jersey number
- Gamified stat callouts (speed, power, skill points, XP level)
- Team name/crest

## 11. Motion layer (future 3D/animated roadmap)

- Idle animation loop
- Celebration animation
- Sport-specific action loop (swing, dribble, kick)
- Card reveal/flip animation
- Particle effects scaled to rarity tier

## 12. Progression / unlock system (ties cosmetics to the app's core loop)

- XP-based unlocks (skins/borders unlock at levels)
- Achievement-based unlocks (attendance streaks, skill certifications, tournament results)
- Collectible/trade mechanic potential (kids "trade" or showcase cards)

---

## Suggested rollout phases

**Phase 1 (MVP, 2D static):** sport, jersey colors/number, one border style, 3–4 backgrounds, basic headwear/hair, skin tone.

**Phase 2 (gamification):** rarity tiers, badges/tags, gear/props, more border materials.

**Phase 3 (differentiator/fun factor):** unique skins (animal heads, costumes), seasonal drops, unlock system tied to XP/achievements.

**Phase 4 (3D/animated):** convert the layered 2D slots into a rigged 3D or animated system reusing the same slot names (base, jersey, headwear, gear, skin, background) so nothing has to be re-architected.

## Asset naming convention (for the pipeline)

Keep every layer independently swappable and named by slot:

```
avatar_base_[sport]_[pose].png
jersey_[team/color]_[pattern].png
headwear_[type]_[sport].png
gear_[sport]_[item].png
border_[tier].png
background_[sport]_[setting].png
skin_[animal-or-costume-name].png
badge_[achievement-name].png
```
