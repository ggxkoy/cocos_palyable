import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';
import { PickupSim } from '../pickups/PickupSim';
import { JobProvider } from '../work/JobProvider';

// 主角模块（纯逻辑）。操作归属：移动由虚拟摇杆驱动，松手即停。
// 感知状态机：每帧找附近最近的物体并分类——
//   金币（敌人掉落）→ 直接入账；废料道具 → 背到身后；
//   敌人 → 按距离判定近战还是远程攻击；
//   都没有 → 范围内自动干活（拉绳打捞/敲击，由 JobProvider 决定），
//   背满挨着回收站自动换弹药。
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
        const enemy = this.enemies.nearestAlive(this.x, this.z, this.config.rangedRange);
        const pickupDistance = usablePickup ? Math.hypot(usablePickup.x - this.x, usablePickup.z - this.z) : Infinity;
        const enemyDistance = enemy ? Math.hypot(enemy.x - this.x, enemy.z - this.z) : Infinity;

        if (enemy && enemyDistance <= pickupDistance) {
            const melee = enemyDistance <= this.config.meleeRange;
            this.setMode(melee ? 'melee' : 'ranged');
            if (this.attackTimer >= this.config.attackInterval) {
                this.attackTimer = 0;
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

        if (this.carried.length > 0) {
            const depot = this.config.depot;
            if (Math.hypot(depot.x - this.x, depot.z - this.z) <= this.config.depositRange) {
                this.setMode('deposit');
                this.actionTimer += deltaTime;
                if (this.actionTimer >= this.config.depositTime) {
                    this.actionTimer = 0;
                    const ammo = this.economy.depositLoad(this.carried);
                    this.carried.length = 0;
                    this.bus.emit('fx:deposit', { x: this.x, z: this.z, amount: ammo });
                }
                return;
            }
        }

        this.setMode('idle');
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
