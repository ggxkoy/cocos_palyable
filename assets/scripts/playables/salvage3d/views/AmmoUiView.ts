import { _decorator, Component } from 'cc';
import { AmmoUiModule } from '../../../modules/ammoui/AmmoUiModule';
import { findHost } from './SalvageView';

const { ccclass } = _decorator;

// 弹药可视化组件：炮塔头顶弹药牌 + 「+N AMMO / +N 金币」飘字。
@ccclass('AmmoUiView')
export class AmmoUiView extends Component {
    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new AmmoUiModule(host.sim.economy, host.config.world.turrets, host.config.defense.ammoCap));
    }
}
