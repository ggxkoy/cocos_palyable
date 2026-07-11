import { _decorator, Component } from 'cc';
import { HudModule } from '../../../modules/hud/HudModule';
import { findHost } from './SalvageView';

const { ccclass } = _decorator;

// HUD 组件：顶部指挥面板（金币/弹药/阶段/下一目标）。
@ccclass('HudView')
export class HudView extends Component {
    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new HudModule(host.config.texts, host.sim.economy, host.sim.goal, host.config.defense.ammoCap));
    }
}
