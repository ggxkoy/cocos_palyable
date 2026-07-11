import { _decorator, CCFloat, Component, Prefab } from 'cc';
import { WorkerCrewModule } from '../../../modules/workers/WorkerCrewModule';
import { findHost } from './SalvageView';

const { ccclass, property } = _decorator;

// 雇员外观组件：工兵模型（复用 09 的蓝兵，Take 001 帧段：移动/砍树/造墙/待机）。
@ccclass('WorkerView')
export class WorkerView extends Component {
    @property(Prefab)
    private workerPrefab: Prefab | null = null;

    @property(CCFloat)
    private fitHeight = 1.55;

    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new WorkerCrewModule(host.sim.workers, host.config.capacity, this.workerPrefab, this.fitHeight));
    }
}
