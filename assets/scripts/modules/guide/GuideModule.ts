import { Color, Node } from 'cc';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { AvatarSim } from '../avatar/AvatarSim';
import { EconomySim } from '../economy/EconomySim';
import { GoalChainSim } from '../goalchain/GoalChainSim';
import { PickupSim } from '../pickups/PickupSim';
import { RopeSim } from '../rope/RopeSim';

// 3D 定向引导标记：悬浮金色菱形，指向玩家该去的下一处——
// 可买目标牌 > 背着子弹包去前线炮塔 > 背满废料去回收机 > 地上的金币
// > 出料口的子弹包堆 > 绳子拉得动的最近残骸。
const MARKER = new Color(255, 216, 95, 255);

export class GuideModule implements PlayableModule {
    private marker: Node | null = null;

    constructor(
        private readonly goal: GoalChainSim,
        private readonly avatar: AvatarSim,
        private readonly rope: RopeSim,
        private readonly pickups: PickupSim,
        private readonly economy: EconomySim,
        private readonly depot: { readonly x: number; readonly z: number },
        private readonly turrets: ReadonlyArray<{ readonly x: number; readonly z: number }>,
        private readonly capacity: number,
    ) {}

    public start(context: ModuleContext): void {
        const marker = createBox3D('GuideMarker', context.world, 0, 2, 0, 0.34, 0.34, 0.34, MARKER);
        marker.setRotationFromEuler(45, 0, 45);
        this.marker = marker;
    }

    public tick(deltaTime: number, time: number): void {
        if (!this.marker) {
            return;
        }
        if (this.goal.phase === 'boom' || this.goal.phase === 'end') {
            this.marker.active = false;
            return;
        }

        let target: { x: number; z: number } | null = null;
        const next = this.goal.next();
        const pile = this.nearestAmmoPile();
        // 背着子弹包且「装满了」或「地上没包可捡了」→ 送去前线（补给线最后一程）。
        // 不满就先在出料口把一背扫齐——一趟送一件的来回太亏，补给会跟不上前线消耗。
        const shouldDeliver = this.avatar.hasPackLoad()
            && (this.avatar.carried.length >= this.capacity || !pile);
        if (next && this.goal.canAffordNext()) {
            target = next;
        } else if (shouldDeliver) {
            target = this.nearestTurret();
        } else if (this.avatar.carried.length >= this.capacity) {
            target = this.depot;
        } else if (!this.economy.hasAmmo()) {
            // 弹池打空：防线在挨打，补给线比捡钱急——先指子弹包堆。
            target = pile ?? this.nearestCoin() ?? this.nearestPullableWreck();
        } else {
            target = this.nearestCoin() ?? pile ?? this.nearestPullableWreck();
        }

        if (!target) {
            this.marker.active = false;
            return;
        }
        this.marker.active = true;
        const bob = Math.sin(time * 5) * 0.18;
        this.marker.setPosition(target.x, 1.9 + bob, target.z);
        this.marker.setRotationFromEuler(45, time * 90 % 360, 45);
    }

    // 金币是升级绳子的唯一来源，地上有钱先引去捡。
    private nearestCoin(): { x: number; z: number } | null {
        let best: { x: number; z: number } | null = null;
        let bestDistance = Infinity;
        for (const pickup of this.pickups.pickups) {
            if (!pickup.alive || pickup.kind !== 'gold') {
                continue;
            }
            const distance = Math.hypot(pickup.x - this.avatar.x, pickup.z - this.avatar.z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = pickup;
            }
        }
        return best;
    }

    private nearestTurret(): { x: number; z: number } | null {
        let best: { x: number; z: number } | null = null;
        let bestDistance = Infinity;
        for (const turret of this.turrets) {
            const distance = Math.hypot(turret.x - this.avatar.x, turret.z - this.avatar.z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = turret;
            }
        }
        return best;
    }

    // 出料口堆着的子弹包：弹池见底时这就是最要紧的一趟。
    private nearestAmmoPile(): { x: number; z: number } | null {
        let best: { x: number; z: number } | null = null;
        let bestDistance = Infinity;
        for (const pickup of this.pickups.pickups) {
            if (!pickup.alive || pickup.kind.indexOf('ammo') !== 0) {
                continue;
            }
            const distance = Math.hypot(pickup.x - this.avatar.x, pickup.z - this.avatar.z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = pickup;
            }
        }
        return best;
    }

    private nearestPullableWreck(): { x: number; z: number } | null {
        let best: { x: number; z: number } | null = null;
        let bestDistance = Infinity;
        for (const wreck of this.rope.wrecks) {
            if (wreck.state === 'respawning' || wreck.tier > this.rope.level) {
                continue;
            }
            const distance = Math.hypot(wreck.x - this.avatar.x, wreck.z - this.avatar.z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = wreck;
            }
        }
        return best;
    }
}
