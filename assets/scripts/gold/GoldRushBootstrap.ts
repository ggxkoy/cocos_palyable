import { Director, director } from 'cc';
import { GoldRushGame } from './GoldRushGame';
import { installAdEventListeners } from './PlayableSdk';

// Project scripts run at engine startup, so this module wires the ad SDK and
// guarantees the maingame scene works without any manual component setup.
installAdEventListeners();

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => {
    const scene = director.getScene();
    if (!scene) {
        return;
    }

    const host = scene.getChildByPath('Canvas/GameRoot') ?? scene.getChildByName('Canvas');
    if (!host) {
        return;
    }

    if (!host.getComponent(GoldRushGame)) {
        host.addComponent(GoldRushGame);
    }
});
