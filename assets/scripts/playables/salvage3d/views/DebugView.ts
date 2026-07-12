import { _decorator, CCBoolean, Component } from 'cc';
import { DebugOverlayModule } from '../../../modules/debug/DebugOverlayModule';
import { findHost } from './SalvageView';

const { ccclass, property } = _decorator;

// 诊断面板组件：enabledOverlay 打开时在屏幕上滚动 diag 日志（模型装配线索）。
@ccclass('DebugView')
export class DebugView extends Component {
    @property(CCBoolean)
    private enabledOverlay = true;

    protected start(): void {
        const host = findHost(this);
        if (!host || !this.enabledOverlay) {
            return;
        }
        host.addModule(new DebugOverlayModule());
    }
}
