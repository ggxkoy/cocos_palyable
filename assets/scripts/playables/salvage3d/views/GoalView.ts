import { _decorator, Component, Prefab } from 'cc';
import { GoalChainModule } from '../../../modules/goalchain/GoalChainModule';
import { findHost } from './SalvageView';

const { ccclass, property } = _decorator;

// 目标链外观组件：目标牌 + 终极打捞物（03_大飞机，长期锚点）。
@ccclass('GoalView')
export class GoalView extends Component {
    @property(Prefab)
    private planePrefab: Prefab | null = null;

    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new GoalChainModule(host.sim.goal, host.sim.economy, host.config.world.vault, this.planePrefab));
    }
}
