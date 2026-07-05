import { _decorator, Camera, Component, Node, director } from 'cc';
import { installAdEventListeners } from '../../common/PlayableSdk';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { AvatarModule } from '../../modules/avatar/AvatarModule';
import { CameraRigModule } from '../../modules/camera/CameraRigModule';
import { DefenseModule } from '../../modules/defense/DefenseModule';
import { EndCardModule } from '../../modules/endcard/EndCardModule';
import { GoalChainModule } from '../../modules/goalchain/GoalChainModule';
import { GuideModule } from '../../modules/guide/GuideModule';
import { HarvestModule } from '../../modules/harvest/HarvestModule';
import { HudModule } from '../../modules/hud/HudModule';
import { StageModule } from '../../modules/stage/StageModule';
import { WorkerCrewModule } from '../../modules/workers/WorkerCrewModule';
import { SALVAGE3D_CONFIG } from './Salvage3DConfig';
import { createSalvageSim } from './SalvageSim';

const { ccclass } = _decorator;

// 3D 模块化拼装示例：一份配置（Salvage3DConfig）+ 一张模块清单。
// 拼接新 playable 时替换配置与清单即可，模块本体不改。
@ccclass('Salvage3DGame')
export class Salvage3DGame extends Component {
    private readonly sim = createSalvageSim(SALVAGE3D_CONFIG);
    private modules: PlayableModule[] = [];
    private elapsed = 0;

    protected onLoad(): void {
        installAdEventListeners();
        const config = SALVAGE3D_CONFIG;

        const scene = director.getScene();
        const world = new Node('World3D');
        scene?.addChild(world);

        const uiCamera = this.node.parent?.getChildByName('Camera')?.getComponent(Camera) ?? null;

        const context: ModuleContext = {
            world,
            ui: this.node,
            bus: this.sim.bus,
            camera3d: null,
        };

        this.modules = [
            new CameraRigModule(config.camera, uiCamera),
            new StageModule({
                ground: config.world.ground,
                depot: config.world.depot,
                hordeLineZ: config.world.hordeLineZ,
            }, this.sim.harvest),
            new HarvestModule(this.sim.harvest, config.veinStock),
            new GoalChainModule(this.sim.goal, this.sim.economy, config.world.vault),
            new DefenseModule(this.sim.defense, config.world.turrets),
            new WorkerCrewModule(this.sim.workers, config.capacity),
            new AvatarModule(this.sim.avatar, this.sim.goal, config.capacity),
            new GuideModule(this.sim.goal, this.sim.avatar, this.sim.harvest, config.world.depot, config.capacity),
            new HudModule(config.texts, this.sim.economy, this.sim.goal, config.defense.ammoCap),
            new EndCardModule(config.texts, config.ctaUrl),
        ];

        for (const module of this.modules) {
            module.start(context);
        }
    }

    protected update(deltaTime: number): void {
        this.elapsed += deltaTime;
        this.sim.tick(deltaTime);
        for (const module of this.modules) {
            module.tick?.(deltaTime, this.elapsed);
        }
    }

    protected onDisable(): void {
        for (const module of this.modules) {
            module.dispose?.();
        }
    }
}
