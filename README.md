# Cocos Playable Minimal Tower Defense

This repository contains a first-pass playable tower-defense rebuild.

It has two parts:

- `web/`: a standalone HTML5 playable preview that can run immediately in a browser.
- `assets/scripts/`: Cocos Creator 3.x TypeScript component source for rebuilding the editable Cocos project.

## Run Preview

Open `web/index.html` directly in a browser, or serve the repo root with any static server.

## Gameplay Slice

- Portrait playable layout.
- Player taps build slots to place towers.
- Enemies move along a lane toward the base.
- Towers auto-fire at enemies.
- Coins are earned from defeated enemies.
- Endcard appears after a short win or fail condition.

## Next Integration Step

Replace the placeholder shapes with production animation assets, then wire the same state model into the Cocos scene nodes.
