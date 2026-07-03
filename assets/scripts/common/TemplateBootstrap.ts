import { Component, Director, director } from 'cc';
import { CrewGame } from '../crew/CrewGame';
import { GoldRushGame } from '../gold/GoldRushGame';
import { Match3Game } from '../match3/Match3Game';
import { MergeGame } from '../merge/MergeGame';
import { RunnerGame } from '../runner/RunnerGame';
import { TowerDefenseGame } from '../towerdefense/TowerDefenseGame';
import { installAdEventListeners } from './PlayableSdk';

// Scene name -> template component. Adding a template means adding a scene
// under assets/scenes/ with a matching name and registering the pair here.
const TEMPLATES: Record<string, new (...args: never[]) => Component> = {
    maingame: GoldRushGame,
    towerdefense: TowerDefenseGame,
    merge: MergeGame,
    match3: Match3Game,
    runner: RunnerGame,
    crew: CrewGame,
};

// Project scripts run at engine startup, so this module wires the ad SDK and
// guarantees every template scene works without any manual component setup.
installAdEventListeners();

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => {
    const scene = director.getScene();
    if (!scene) {
        return;
    }

    const template = TEMPLATES[scene.name];
    if (!template) {
        return;
    }

    const host = scene.getChildByPath('Canvas/GameRoot') ?? scene.getChildByName('Canvas');
    if (!host) {
        return;
    }

    if (!host.getComponent(template)) {
        host.addComponent(template);
    }
});
