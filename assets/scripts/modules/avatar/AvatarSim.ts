import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';
import { HarvestSim } from '../harvest/HarvestSim';
import { PickupSim } from '../pickups/PickupSim';

// 主角模块（纯逻辑）。操作归属：移动由虚拟摇杆驱动，松手即停。
// 感知状态机（设计规格）：每帧找附近最近的物体并分类——
//   道具（金子/木材…）→ 自动拾取背到身后；
//   敌人 → 按距离判定近战还是远程攻击；
//   都没有 → 挨着残骸自动敲击（产出类型化掉落物）、挨着回收站自动结算。
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
    readonly strikeInterval: number;
    readonly depositTime: number;
    readonly actionRange: number;
    readonly depositRange: number;
    readonly pickupRange: number;
    readonly meleeRange: number;
    readonly rangedRange: number;
    readonly attackInterval: number;
    readonly attackDamage: number;
    readonly bounds: { readonly halfWidth: number; readonly halfLength: number };
}

export type AvatarMode = 'idle' | 'collect' | 'strike' | 'melee' | 'ranged' | 'deposit';

export class AvatarSim {
    public x: number;
    public z: number;
    public readonly carried: string[] = [];
    public mode: AvatarMode = 'idle';
    public inputX = 0;
    public inputZ = 0;

    private actionTimer = 0;
    private attackTimer = 0;

    constructor(
        private readonly config: AvatarConfig,
        private readonly harvest: HarvestSim,
        private readonly pickups: PickupSim,
        private readonly enemies: EnemyQuery,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {
        this.x = config.spawn.x;
        this.z = config.spawn.z;
    }

    // 摇杆输入：分量为 -1..1 的方向乘力度；(0,0) 即松手。
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
            this.z = Math.max(-bounds.halfLength, Math.min(bounds.halfLength, this.z + this.inputZ * this.config.speed * deltaTime));
        }
        this.attackTimer += deltaTime;

        // 感知：范围内最近的道具与敌人，谁近听谁的。
        const pickup = this.carried.length < this.config.capacity
            ? this.pickups.nearestAlive(this.x, this.z, this.config.pickupRange)
            : null;
        const enemy = this.enemies.nearestAlive(this.x, this.z, this.config.rangedRange);
        const pickupDistance = pickup ? Math.hypot(pickup.x - this.x, pickup.z - this.z) : Infinity;
        const enemyDistance = enemy ? Math.hypot(enemy.x - this.x, enemy.z - this.z) : Infinity;

        if (enemy && enemyDistance <= pickupDistance) {
            // 敌人更近：近战/远程由距离决定。
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

        if (pickup) {
            // 道具更近：自动吸附背到身后（每帧吸一件）。
            this.setMode('collect');
            const kind = this.pickups.collect(pickup);
            this.carried.push(kind);
            this.bus.emit('fx:pickup', { kind, x: pickup.x, z: pickup.z });
            return;
        }

        if (this.carried.length < this.config.capacity) {
            const vein = this.harvest.nearestStocked(this.x, this.z, this.config.actionRange);
            if (vein) {
                this.setMode('strike');
                this.actionTimer += deltaTime;
                while (this.actionTimer >= this.config.strikeInterval && vein.stock > 0) {
                    this.actionTimer -= this.config.strikeInterval;
                    const kind = this.harvest.hit(vein);
                    if (kind) {
                        // 敲落的资源散在残骸旁，下一帧会被自动拾取。
                        const spread = ((vein.stock * 53) % 100) / 100 - 0.5;
                        this.bus.emit('fx:strike', { x: vein.x, z: vein.z });
                        this.pickupsSpawnNear(kind, vein.x + spread, vein.z + 0.55);
                    }
                }
                return;
            }
        }

        if (this.carried.length > 0) {
            const depot = this.config.depot;
            if (Math.hypot(depot.x - this.x, depot.z - this.z) <= this.config.depositRange) {
                this.setMode('deposit');
                this.actionTimer += deltaTime;
                if (this.actionTimer >= this.config.depositTime) {
                    this.actionTimer = 0;
                    const amount = this.economy.depositLoad(this.carried);
                    this.carried.length = 0;
                    this.bus.emit('fx:deposit', { x: this.x, z: this.z, amount });
                }
                return;
            }
        }

        this.setMode('idle');
    }

    private pickupsSpawnNear(kind: string, x: number, z: number): void {
        this.pickups.spawn(kind, x, z);
    }

    private setMode(mode: AvatarMode): void {
        if (this.mode !== mode) {
            this.mode = mode;
            this.actionTimer = 0;
        }
    }
}
