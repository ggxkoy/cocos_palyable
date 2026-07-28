import { _decorator, Component, Material, Prefab } from 'cc';
import { StageModule } from '../../../modules/stage/StageModule';
import { findHost } from './SalvageView';

const { ccclass, property } = _decorator;

// 场地外观组件：地面材质（07_沙漠泥潭材质做成 Material 拖入）、回收站（04）。
@ccclass('StageView')
export class StageView extends Component {
    @property(Prefab)
    private depotPrefab: Prefab | null = null;

    @property(Material)
    private groundMaterial: Material | null = null;

    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        const world = host.config.world;
        host.addModule(new StageModule({
            ground: world.ground,
            swamp: world.swamp,
            depot: world.depot,
            output: host.config.depot.output,
            hordeLineZ: world.hordeLineZ,
        }, this.depotPrefab, this.groundMaterial));
    }
}
