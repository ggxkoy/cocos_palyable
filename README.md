# Cocos Playable Rebuilds

This repository contains small playable rebuild slices for Cocos Creator style ad flows.

## Included Files

- `web/index.html`: standalone HTML5 tower-defense playable preview.
- `web/gold/index.html`: standalone HTML5 playable rebuilt from the `reference/gold-reference.html` flow.
- `reference/gold-reference.html`: original single-file Cocos playable reference package, copied from `金闪闪.html`.
- `assets/scripts/`: Cocos Creator 3.x TypeScript component source for rebuilding the editable Cocos project.

## Run Preview

Open `web/index.html` or `web/gold/index.html` directly in a browser, or serve the repo root with any static server.

## Tower Defense Slice

- Portrait playable layout.
- Player taps build slots to place towers.
- Enemies move along a lane toward the base.
- Towers auto-fire at enemies.
- Coins are earned from defeated enemies.
- Endcard appears after a short win or fail condition.

## Gold Rush Slice

`web/gold/` is a clean rebuild that follows the playable flow in `reference/gold-reference.html`. It is not a direct edit of the original Cocos bundle.

- Portrait playable layout.
- Player taps three shining crates to collect gold.
- Upgrade button spends gold and upgrades the command base.
- Reinforcements attack a short enemy wave.
- Endcard CTA opens the same Last War playable campaign URL used by the reference package.

## Next Integration Step

Replace the placeholder shapes with production animation assets, then wire the same state model into the Cocos scene nodes.
