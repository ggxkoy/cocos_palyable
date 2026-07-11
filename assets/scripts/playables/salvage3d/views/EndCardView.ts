import { _decorator, Component } from 'cc';
import { EndCardModule } from '../../../modules/endcard/EndCardModule';
import { findHost } from './SalvageView';

const { ccclass } = _decorator;

// 结算卡组件：胜利/失败卡 + REVIVE 复活重试 + CTA。
@ccclass('EndCardView')
export class EndCardView extends Component {
    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new EndCardModule(
            host.config.texts,
            host.config.ctaUrl,
            () => host.sim.goal.revive(),
            () => host.sim.goal.retriesLeft > 0,
        ));
    }
}
