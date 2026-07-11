import { _decorator, Camera, Component, Node, director } from 'cc';
import { installAdEventListeners } from '../../common/PlayableSdk';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { CameraRigModule } from '../../modules/camera/CameraRigModule';
import { SALVAGE3D_CONFIG, Salvage3DConfig } from './Salvage3DConfig';
import { SalvageSim, createSalvageSim } from './SalvageSim';

const { ccclass } = _decorator;

// 拼装宿主：只负责 sim + 共享上下文 + 模块注册表 + 主循环。
// 所有视觉与美术槽位拆进 views/ 下的独立 View 组件（场景里每个一个节点），
// 改某一块的表现只动对应组件，互不牵扯；模块之间也只通过事件总线通信。
@ccclass('Salvage3DGame')
export class Salvage3DGame extends Component {
    public readonly config: Salvage3DConfig = SALVAGE3D_CONFIG;
    public readonly sim: SalvageSim = createSalvageSim(SALVAGE3D_CONFIG);

    private context: ModuleContext | null = null;
    private readonly modules: PlayableModule[] = [];
    private elapsed = 0;

    protected onLoad(): void {
        installAdEventListeners();
        const scene = director.getScene();
        const world = new Node('World3D');
        scene?.addChild(world);

        const uiCamera = this.node.parent?.getChildByName('Camera')?.getComponent(Camera) ?? null;
        this.context = {
            world,
            ui: this.node,
            bus: this.sim.bus,
            camera3d: null,
        };
        // 相机/灯光是所有视觉的前提，宿主先建；其余模块由各 View 组件注册。
        this.addModule(new CameraRigModule(this.config.camera, uiCamera, () => ({ x: this.sim.avatar.x, z: this.sim.avatar.z })));
    }

    // View 组件在自己的 start() 里调用（宿主在父节点，onLoad 先于子节点组件执行）。
    public addModule(module: PlayableModule): void {
        if (!this.context) {
            return;
        }
        this.modules.push(module);
        module.start(this.context);
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
