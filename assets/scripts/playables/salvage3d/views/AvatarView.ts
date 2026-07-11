import { _decorator, AnimationClip, CCFloat, Component, Prefab } from 'cc';
import { AvatarModule } from '../../../modules/avatar/AvatarModule';
import { findHost } from './SalvageView';

const { ccclass, property } = _decorator;

// 主角外观组件（01_主角）：模型 prefab + 七个状态的 FBX 剪辑槽位。
// 只改主角的表现就只动这个组件。fitHeight 把模型自适应到目标身高（0=不缩放）。
@ccclass('AvatarView')
export class AvatarView extends Component {
    @property(Prefab)
    private playerPrefab: Prefab | null = null;

    @property(AnimationClip)
    private idleClip: AnimationClip | null = null;

    @property(AnimationClip)
    private walkClip: AnimationClip | null = null;

    @property(AnimationClip)
    private collectClip: AnimationClip | null = null;

    @property(AnimationClip)
    private workClip: AnimationClip | null = null;

    @property(AnimationClip)
    private meleeClip: AnimationClip | null = null;

    @property(AnimationClip)
    private rangedClip: AnimationClip | null = null;

    @property(AnimationClip)
    private depositClip: AnimationClip | null = null;

    @property(CCFloat)
    private fitHeight = 1.7;

    protected start(): void {
        const host = findHost(this);
        if (!host) {
            return;
        }
        host.addModule(new AvatarModule(host.sim.avatar, this.playerPrefab, {
            idle: this.idleClip,
            walk: this.walkClip,
            collect: this.collectClip,
            work: this.workClip,
            melee: this.meleeClip,
            ranged: this.rangedClip,
            deposit: this.depositClip,
        }, this.fitHeight));
    }
}
