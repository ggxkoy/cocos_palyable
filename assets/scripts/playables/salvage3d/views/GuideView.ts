import { _decorator, Component } from 'cc';
import { GuideModule } from '../../../modules/guide/GuideModule';
import { findHost } from './SalvageView';

const { ccclass } = _decorator;

// 定向引导外观组件：悬浮菱形指引下一步该去哪。
@ccclass('GuideView')
export class GuideView extends Component {
    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new GuideModule(
            host.sim.goal,
            host.sim.avatar,
            host.sim.rope,
            host.sim.pickups,
            host.sim.economy,
            host.config.world.depot,
            host.config.world.turrets,
            host.config.capacity,
        ));
    }
}
