import { _decorator, Component } from 'cc';
import { PickupModule } from '../../../modules/pickups/PickupModule';
import { findHost } from './SalvageView';

const { ccclass } = _decorator;

// 掉落物外观组件：金币/分级废料的地面表现。
@ccclass('PickupView')
export class PickupView extends Component {
    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new PickupModule(host.sim.pickups));
    }
}
