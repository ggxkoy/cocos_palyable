# Cocos Playable Rebuilds

This repository contains small playable rebuild slices for Cocos Creator style ad flows.

It has two parts:

- `web/`: a standalone HTML5 tower-defense playable preview that can run immediately in a browser.
- `web/gold/`: a second standalone playable based on the `金闪闪.html` flow: tap glowing gold rewards, upgrade the base, show a short battle, then end on a CTA.
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

- Portrait playable layout.
- Player taps three shining crates to collect gold.
- Upgrade button spends gold and upgrades the command base.
- Reinforcements attack a short enemy wave.
- Endcard CTA opens the same Last War playable campaign URL used by the reference package.

## Next Integration Step

Replace the placeholder shapes with production animation assets, then wire the same state model into the Cocos scene nodes.
