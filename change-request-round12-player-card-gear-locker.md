# Level Up Athletics — Change Request, Round 12: Player Card Gear Locker

**For Claude Code.** Same tagging convention as prior rounds: **[Cosmetic]**, **[Functional]**, **[Structural]**.

**Background:** the Player Card avatar today is just `avatarOptions` — 8 hardcoded emoji (`⚾🧢🦸‍♂️🐻🦅🔥⭐💪`) randomly assigned by the "Create Avatar" button, or a real uploaded photo. Separately, `lockerItems` already lists 8 cosmetic-sounding names (Fire Player Frame, Diamond Card Border, Pinstripe Jersey, Gold Bat Grip, Lightning Eye Black, Captain Title, Blueprint Card Background, Stadium Lights Background) that get randomly unlocked into `state.inventory` whenever `completeDailyMission()` runs — but there is no `#lockerInventory` element anywhere in `index.html`, so `renderLocker()` has never actually rendered anything; this system has been fully inert. This round turns that into a real, equippable avatar system, sold through the existing Reward Locker XP-spend economy (`availableBalance()`/`claimReward()`/`rewardMilestones`) rather than a second, separate one.

**Important — don't confuse the two reward systems already in the code:** `rewardMilestones` (Ice Cream Single, Batting Cage Trip, MVP Surprise, etc.) are real-world, parent-fulfilled prizes and are untouched by this round. The new cosmetic shop below is a second, much cheaper catalog living alongside it, spending from the same `availableBalance()` pool.

---

## Part 1 — Data Model

1. **[Structural]** Restructure `lockerItems` from a flat name array into a slotted catalog — each entry needs at minimum `{id, name, slot, xpCost, tier}`. Six slots: `frame`, `background`, `outfit`, `prop`, `faceAccent`, `title` (title is text-only, no art). Starting catalog, reusing the 8 existing names: Blueprint Card Background (background, Common), Stadium Lights Background (background, Uncommon), Fire Player Frame (frame, Rare), Diamond Card Border (frame, Legendary), Pinstripe Jersey (outfit, Common), Gold Bat Grip (prop, Uncommon), Lightning Eye Black (faceAccent, Common), Captain Title (title, Rare). Suggested XP costs by tier: Common 75-100, Uncommon 150, Rare 250, Legendary 400 — much cheaper than `rewardMilestones` since these are instant/digital. Every slot should have exactly one built-in, free, always-owned "Default" item (plain frame, plain background, no outfit overlay, no prop, no face accent, no title) so the avatar never looks unfinished before anything is purchased.
2. **[Structural]** Add `state.inventory` (already referenced by the dead code, now becomes real — array of owned item ids, seeded with the six Default items) and `state.equipped` (`{frame:'default', background:'default', outfit:'default', prop:'default', faceAccent:'default', title:'default'}`). Ownership and equipping are separate actions: buying an item adds it to `state.inventory` permanently; equipping just changes `state.equipped` and is always free, including switching back to Default.
3. **[Structural]** Keep the base avatar figure itself simple: one single branded athlete silhouette (not a roster of different characters/creatures — that was considered and intentionally scoped out, see Round notes), built as a swappable-art-slot lookup the same way `tierBadges` already works — falls back to a plain placeholder shape if no file is present, so this round isn't blocked on final art. Real art (the base figure plus the 6 catalog items' visuals) is a separate production step — see Part 4.

---

## Part 2 — Cosmetic Shop in the Reward Locker

4. **[Functional]** Add a new card to the `#rewards` screen (there is no existing element for this — it needs to be built from scratch, unlike the Reward Milestones section) titled something like "Gear Locker" or "Player Card Shop," listing the 6 non-default catalog items grouped by slot, each showing its XP cost and a Buy button that's disabled/greyed out if `availableBalance()` is under its cost — mirror the existing `claimReward()` pattern (spend from the same balance, parent-approval framing optional here since these are digital, not real-world — your call whether to require it, given `rewardMilestones` claims currently list `approvedBy:'Parent'`).
5. **[Functional]** Once purchased, an item is permanently in `state.inventory` — no re-buying. Add a separate, free "Equip" control (could live in this same new card, or on the Player Card itself — your call) letting the athlete pick which owned item fills each slot, always including Default as a free option to switch back to.

---

## Part 3 — Player Card & Avatar Rendering

6. **[Functional]** Replace the current `avatarOptions` random-emoji "Create Avatar" flow with the new equipped-gear composite: render the base silhouette plus whatever's currently in each `state.equipped` slot (frame around the edge, background behind, outfit overlay, prop icon, face accent overlay), skipping any slot set to Default. The existing photo-upload option can stay as an alternative to the illustrated avatar — your call whether both coexist or the illustrated avatar becomes the only option once this ships.
7. **[Cosmetic]** Show the equipped Title (e.g. "Captain") as a small text badge near the athlete's name on the Player Card, distinct from the tier name (`Rookie`/`Grinder`/etc.) — these are two different pieces of text and shouldn't be visually confused with each other.

---

## Part 4 — Art Production (once code above is in place)

8. **[No code change — reference only]** Once the Adobe for Creativity connector is generating the base silhouette and the art for each of the 6 catalog items (in the same flat-vector sticker/patch style as the six ladder badges, for visual consistency), drop the files into the swappable-art-slot paths from item 3 with zero further code changes — same pattern already proven with `tierBadges`.

---

## Part 5 — Daily Mission Reward (variable, not guaranteed-both)

9. **[Functional — confirm before building, see Open Questions]** Change `completeDailyMission()` so it rolls once and grants **either** a mystery cosmetic item (via the existing `unlockRandomItem()`-style logic, now drawing from the slotted catalog) **or** a bonus XP amount — not both, as it does today (currently always +40 XP AND always a mystery item). If the item roll lands on something already owned, fall back to the XP outcome for that day rather than a wasted duplicate.

---

## Explicitly Out of Scope This Round

- Showing the equipped avatar on the Athlete home-page path-card icon — a great next step once the base figure and gear actually exist and look good, but sequenced as a follow-on round, not this one.
- A roster of distinct selectable characters/creatures — intentionally scoped down to one base figure plus gear (see Part 1, item 3).
- Any changes to `rewardMilestones` or the real-world reward claim flow.
- Selling back or refunding purchased gear.
- Expanding the catalog beyond the 8 starting items — easy to add more later using the same slotted shape.

---

## Open Questions

1. **Daily mission reward shape (item 9):** confirm the either/or interpretation above (one roll, item *or* XP, not both), or specify that the +40 XP should stay guaranteed with only the item being a separate chance on top.
2. Whether purchasing a cosmetic item needs the same parent-approval step as real-world reward claims, or can be instant since nothing physical is being fulfilled (item 4).
3. Whether the photo-upload option stays alongside the illustrated avatar once gear exists, or the illustrated avatar replaces it (item 6).
4. "Gold Bat Grip" and "Pinstripe Jersey" are baseball-flavored names left over from before the app went sport-agnostic (Round 9) — fine to keep as flavor text, or rename to something sport-neutral now while the catalog is small?

---

## Acceptance Criteria

- [ ] `lockerItems` is a slotted catalog (`frame`/`background`/`outfit`/`prop`/`faceAccent`/`title`) with XP costs; each slot has a free Default.
- [ ] A new Gear Locker/shop card exists on the `#rewards` screen and lets an athlete buy an item if `availableBalance()` covers its cost.
- [ ] Owned items can be freely equipped/unequipped per slot at no XP cost.
- [ ] The Player Card avatar renders the base figure plus whatever's currently equipped, replacing the old random-emoji flow.
- [ ] `completeDailyMission()` grants either an item or bonus XP per the confirmed interpretation in Open Question 1 — not unconditionally both.
- [ ] No new `<script src>` or package dependency has been added; base figure and item art use the same swappable-placeholder-fallback pattern as `tierBadges`.
