import { _decorator, AnimationClip, CCFloat, Component, Prefab } from 'cc';
import { DefenseModule } from '../../../modules/defense/DefenseModule';
import { findHost } from './SalvageView';

const { ccclass, property } = _decorator;

// 防线外观组件：炮塔（05）、炮塔小兵（09，帧段动画）、敌军（06，独立剪辑）、
// BOSS（08，帧段动画）与围墙。只改防线表现就只动这个组件。
@ccclass('DefenseView')
export class DefenseView extends Component {
    @property(Prefab)
    private turretPrefab: Prefab | null = null;

    @property(Prefab)
    private soldierPrefab: Prefab | null = null;

    @property(Prefab)
    private enemyPrefab: Prefab | null = null;

    @property(Prefab)
    private bossPrefab: Prefab | null = null;

    @property(AnimationClip)
    private enemyMoveClip: AnimationClip | null = null;

    @property(AnimationClip)
    private enemyAttackClip: AnimationClip | null = null;

    @property(AnimationClip)
    private enemyHitClip: AnimationClip | null = null;

    @property(AnimationClip)
    private enemyDeathClip: AnimationClip | null = null;

    @property(CCFloat)
    private enemyHeight = 1.45;

    @property(CCFloat)
    private bossHeight = 2.6;

    @property(CCFloat)
    private soldierHeight = 1.45;

    @property(CCFloat)
    private turretHeight = 1.6;

    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        const config = host.config;
        host.addModule(new DefenseModule(
            host.sim.defense,
            config.world.turrets,
            config.defense.deathTime,
            config.world.hordeLineZ,
            {
                turretPrefab: this.turretPrefab,
                soldierPrefab: this.soldierPrefab,
                enemyPrefab: this.enemyPrefab,
                bossPrefab: this.bossPrefab,
                enemyClips: {
                    move: this.enemyMoveClip,
                    attack: this.enemyAttackClip,
                    hit: this.enemyHitClip,
                    death: this.enemyDeathClip,
                },
                enemyHeight: this.enemyHeight,
                bossHeight: this.bossHeight,
                soldierHeight: this.soldierHeight,
                turretHeight: this.turretHeight,
                wall: { z: config.world.hordeLineZ, width: config.world.ground.width },
            },
        ));
    }
}
