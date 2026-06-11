# Cocos Playable Rebuilds

This repository is an editable Cocos Creator 3.8 project that rebuilds the playable ad flow from `reference/gold-reference.html` (the original "金闪闪" / Last War single-file package), plus standalone HTML5 preview slices.

## Open in Cocos Creator

1. Open Cocos Creator Dashboard (3.8.x) and add the repository root as a project.
2. Let the editor import the assets (it generates the missing `.meta` files on first open — commit them afterwards).
3. Open `assets/scenes/maingame.scene` and press Preview.

No manual wiring is required: `GoldRushBootstrap.ts` attaches the `GoldRushGame` component to `Canvas/GameRoot` automatically when the scene launches, and every missing art asset is rendered as a tinted placeholder box.

## Gold Rush Playable (Cocos source)

Rebuilt from the reference package flow (Cocos Creator 3.6.5 original, portrait 720x1280):

1. **Collect** – tap the three shining crates; each pays 25 gold with a coin-fly and spark burst, guided by a bobbing hand hint.
2. **Upgrade** – the pulsing button spends 75 gold and upgrades the command base (lift, gold roof, flag).
3. **Battle** – three reinforcements advance and fire while the enemy wave fades out behind a progress bar.
4. **End** – the VICTORY end card shows; the CTA opens `https://lastwar.onelink.me/PXmq/playable` through the multi-network `download()` chain (MRAID → Facebook Playable → dapi → postMessage/ExitApi → `window.open`). `ad-event-pause` / `ad-event-resume` pause and resume the engine, matching the reference package lifecycle.

### Source layout

- `assets/scenes/maingame.scene` – minimal scene (Canvas + Camera + `GameRoot`); the full node tree is built in code.
- `assets/scripts/gold/GoldRushModel.ts` / `GoldRushTypes.ts` – pure state machine (collect → upgrade → battle → end).
- `assets/scripts/gold/GoldRushView.ts` – builds every node and drives all animation; layout constants mirror `web/gold/playable.js`.
- `assets/scripts/gold/GoldRushGame.ts` – main component: input binding, model/view glue, `SpriteFrame` art slots.
- `assets/scripts/gold/PlaceholderFactory.ts` – runtime-generated white frame + tinted box/label helpers.
- `assets/scripts/gold/PlayableSdk.ts` – CTA `download()` chain and ad lifecycle listeners.
- `assets/scripts/gold/GoldRushBootstrap.ts` – auto-attaches `GoldRushGame` at scene launch.

### Replacing the placeholder art

`GoldRushGame` exposes one `SpriteFrame` property per asset: `backgroundFrame`, `crateFrame`, `baseFrame`, `soldierFrame`, `enemyFrame`, `coinFrame`, `buttonFrame`, `handFrame`.

1. Import the production images into `assets/`.
2. Select `Canvas/GameRoot` in the scene and add the `GoldRushGame` component manually (the bootstrap detects it and will not add a second one).
3. Drag each SpriteFrame into its slot. Filled slots use the real art; empty slots keep the tinted box, and the hand-drawn detail boxes (planks, door, gun, etc.) are skipped automatically for nodes that received real art.

### Repo typecheck note

`npm run typecheck` validates all gameplay scripts against the hand-written stub in `types/cc.d.ts`. Inside Cocos Creator the editor supplies the real engine declarations; if your IDE reports a duplicate `cc` module, remove `types/**/*.d.ts` from the `include` list in `tsconfig.json` (the stub is only needed for editor-less CI checks).

## HTML5 Preview Slices

Open `web/index.html` (tower defense) or `web/gold/index.html` (gold rush) directly in a browser, or serve the repo root with any static server. `web/gold/` follows the same flow and constants as the Cocos source and is useful as a behavioral reference.

## Reference Package

`reference/gold-reference.html` is the original single-file Cocos playable (obfuscated, assets embedded). The rebuild reuses its design resolution (720x1280 portrait), scene name (`maingame`), CTA URL, and ad lifecycle events, but is a clean re-implementation rather than an edit of the bundle.
