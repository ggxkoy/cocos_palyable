import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';
import { PickupSim } from '../pickups/PickupSim';
import { JobProvider } from '../work/JobProvider';

// 主角模块（纯逻辑）。操作归属：移动由虚拟摇杆驱动，松手即停。
// 感知状态机：每帧找附近最近的物体并分类——
//   金币（敌人掉落）→ 直接入账；废料/子弹包 → 背到身后；
//   敌人 → 按距离判定近战还是远程攻击；
//   都没有 → 范围内自动干活（拉绳打捞/敲击，由 JobProvider 决定）。
// 补给线（实体搬运，不是抽象计数）：背上的废料挨着回收机自动卸进机器，
// 机器加工出的子弹包（'ammo*'）背上后送到前线炮塔（supplyPoints）才入弹池。
// 没有子弹就无法攻击：主角每次出手消耗 1 发弹药（与炮塔同一弹池），
// 弹药打空时感知直接忽略敌人——只能回去跑补给线，这就是压力循环。
export interface EnemyContact {
    readonly id: number;
    readonly x: number;
    readonly z: number;
}

export interface EnemyQuery {
    nearestAlive(x: number, z: number, range: number): EnemyContact | null;
    damage(enemyId: number, amount: number): boolean;
}

export interface AvatarConfig {
    readonly spawn: { readonly x: number; readonly z: number };
    readonly depot: { readonly x: number; readonly z: number };
    /** 前线交付点（炮塔位），子弹包送到任意一处入弹池。 */
    readonly supplyPoints: ReadonlyArray<{ readonly x: number; readonly z: number }>;
    readonly supplyRange: number;
    /** 子弹包 kind → 弹药面值。 */
    readonly packValues: Readonly<Record<string, number>>;
    readonly speed: number;
    readonly capacity: number;
    readonly depositTime: number;
    readonly workSearchRange: number;
    readonly depositRange: number;
    readonly pickupRange: number;
    readonly meleeRange: number;
    readonly rangedRange: number;
    readonly attackInterval: number;
    readonly attackDamage: number;
    readonly bounds: { readonly halfWidth: number; readonly minZ: number; readonly maxZ: number };
}

/** 回收机入料口（DepotSim 实现；解耦成接口便于单测）。 */
export interface ScrapIntake {
    enqueue(load: ReadonlyArray<string>): number;
}

export type AvatarMode = 'idle' | 'collect' | 'work' | 'melee' | 'ranged' | 'deposit';

export class AvatarSim {
    public x: number;
    public z: number;
    public readonly carried: string[] = [];
    public mode: AvatarMode = 'idle';
    public inputX = 0;
    public inputZ = 0;
    public workJobId: number | null = null;

    private actionTimer = 0;
    private attackTimer = 0;

    constructor(
        private readonly config: AvatarConfig,
        private readonly job: JobProvider,
        private readonly pickups: PickupSim,
        private readonly enemies: EnemyQuery,
        private readonly economy: EconomySim,
        private readonly depot: ScrapIntake,
        private readonly bus: EventBus,
    ) {
        this.x = config.spawn.x;
        this.z = config.spawn.z;
    }

    public setMoveInput(inputX: number, inputZ: number): void {
        const magnitude = Math.hypot(inputX, inputZ);
        if (magnitude > 1) {
            this.inputX = inputX / magnitude;
            this.inputZ = inputZ / magnitude;
        } else {
            this.inputX = inputX;
            this.inputZ = inputZ;
        }
    }

    public get moving(): boolean {
        return this.inputX !== 0 || this.inputZ !== 0;
    }

    public tick(deltaTime: number): void {
        if (this.moving) {
            const bounds = this.config.bounds;
            this.x = Math.max(-bounds.halfWidth, Math.min(bounds.halfWidth, this.x + this.inputX * this.config.speed * deltaTime));
            this.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, this.z + this.inputZ * this.config.speed * deltaTime));
        }
        this.attackTimer += deltaTime;

        // 感知：范围内最近的道具与敌人，谁近听谁的。
        const pickup = this.pickups.nearestAlive(this.x, this.z, this.config.pickupRange);
        const usablePickup = pickup && (pickup.kind === 'gold' || this.carried.length < this.config.capacity) ? pickup : null;
        // 没弹药就不索敌：打不了，去捞废料换子弹。
        const enemy = this.economy.hasAmmo() ? this.enemies.nearestAlive(this.x, this.z, this.config.rangedRange) : null;
        const pickupDistance = usablePickup ? Math.hypot(usablePickup.x - this.x, usablePickup.z - this.z) : Infinity;
        const enemyDistance = enemy ? Math.hypot(enemy.x - this.x, enemy.z - this.z) : Infinity;

        if (enemy && enemyDistance <= pickupDistance) {
            const melee = enemyDistance <= this.config.meleeRange;
            this.setMode(melee ? 'melee' : 'ranged');
            if (this.attackTimer >= this.config.attackInterval) {
                this.attackTimer = 0;
                this.economy.consumeAmmo(1);
                this.enemies.damage(enemy.id, this.config.attackDamage);
                this.bus.emit(melee ? 'fx:melee' : 'fx:shot', {
                    fromX: this.x,
                    fromZ: this.z,
                    toX: enemy.x,
                    toZ: enemy.z,
                });
            }
            return;
        }

        if (usablePickup) {
            this.setMode('collect');
            const kind = this.pickups.collect(usablePickup);
            if (kind === 'gold') {
                // 金币是货币，直接入账（杀敌 → 金币 → 升级绳子）。
                const value = this.economy.collectCoin();
                this.bus.emit('fx:coin', { x: usablePickup.x, z: usablePickup.z, value });
            } else {
                this.carried.push(kind);
                this.bus.emit('fx:pickup', { kind, x: usablePickup.x, z: usablePickup.z });
            }
            return;
        }

        // 范围内自动干活（拉绳打捞等）。
        const jobId = this.workJobId;
        if (jobId !== null && this.job.canWork('avatar', jobId, this.x, this.z)) {
            this.setMode('work');
            const result = this.job.work('avatar', jobId, this.x, this.z, deltaTime);
            if (result !== 'working') {
                this.workJobId = null;
            }
            return;
        }
        this.workJobId = null;
        const nextJob = this.job.nearestJob(this.x, this.z, this.config.workSearchRange);
        if (nextJob && this.job.canWork('avatar', nextJob.id, this.x, this.z)) {
            this.workJobId = nextJob.id;
            this.setMode('work');
            this.job.work('avatar', nextJob.id, this.x, this.z, deltaTime);
            return;
        }

        // 背上有子弹包且挨着前线炮塔 → 交付入弹池。
        if (this.hasPackLoad() && this.nearestSupplyDistance() <= this.config.supplyRange) {
            this.setMode('deposit');
            this.actionTimer += deltaTime;
            if (this.actionTimer >= this.config.depositTime) {
                this.actionTimer = 0;
                let amount = 0;
                for (let i = this.carried.length - 1; i >= 0; i -= 1) {
                    const value = this.config.packValues[this.carried[i]];
                    if (value !== undefined) {
                        amount += value;
                        this.carried.splice(i, 1);
                    }
                }
                const gained = this.economy.supplyAmmo(amount);
                this.bus.emit('fx:supply', { x: this.x, z: this.z, amount: gained });
            }
            return;
        }

        // 背上有废料且挨着回收机 → 卸进机器排队加工（不直接变弹药）。
        if (this.hasScrapLoad()) {
            const depot = this.config.depot;
            if (Math.hypot(depot.x - this.x, depot.z - this.z) <= this.config.depositRange) {
                this.setMode('deposit');
                this.actionTimer += deltaTime;
                if (this.actionTimer >= this.config.depositTime) {
                    this.actionTimer = 0;
                    const scrap = this.carried.filter(kind => this.config.packValues[kind] === undefined);
                    const accepted = this.depot.enqueue(scrap);
                    for (let i = this.carried.length - 1; i >= 0; i -= 1) {
                        if (this.config.packValues[this.carried[i]] === undefined) {
                            this.carried.splice(i, 1);
                        }
                    }
                    this.bus.emit('fx:deposit', { x: this.x, z: this.z, count: accepted });
                }
                return;
            }
        }

        this.setMode('idle');
    }

    public hasPackLoad(): boolean {
        return this.carried.some(kind => this.config.packValues[kind] !== undefined);
    }

    public hasScrapLoad(): boolean {
        return this.carried.some(kind => this.config.packValues[kind] === undefined);
    }

    private nearestSupplyDistance(): number {
        let best = Infinity;
        for (const point of this.config.supplyPoints) {
            best = Math.min(best, Math.hypot(point.x - this.x, point.z - this.z));
        }
        return best;
    }

    private setMode(mode: AvatarMode): void {
        if (this.mode !== mode) {
            if (this.mode === 'work') {
                this.job.release('avatar');
            }
            this.mode = mode;
            this.actionTimer = 0;
        }
    }
}
