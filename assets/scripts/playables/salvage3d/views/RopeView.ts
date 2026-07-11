import { _decorator, Component, Prefab } from 'cc';
import { RopeModule } from '../../../modules/rope/RopeModule';
import { findHost } from './SalvageView';

const { ccclass, property } = _decorator;

// 打捞外观组件：泥潭残骸模型（02_小残骸）＋拉拽绳索表现。
@ccclass('RopeView')
export class RopeView extends Component {
    @property(Prefab)
    private wreckPrefab: Prefab | null = null;

    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new RopeModule(host.sim.rope, this.wreckPrefab));
    }
}
