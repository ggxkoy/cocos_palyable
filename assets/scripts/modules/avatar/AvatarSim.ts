import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';
import { HarvestSim } from '../harvest/HarvestSim';

// 主角模块（纯逻辑）。操作归属：移动只响应玩家 commandMove，
// 停手即停在原地；仅有「范围内自动交互」（挨着残骸自动拉拽、挨着回收站自动投递）。
export interface AvatarConfig {
    readonly spawn: { readonly x: number; readonly z: number };
    readonly depot: { readonly x: number; readonly z: number };
    readonly speed: number;
    readonly capacity: number;
    readonly strikeInterval: number;
    readonly yieldPerStrike: number;
    readonly depositTime: number;
    readonly actionRange: number;
    readonly depositRange: number;
    readonly bounds: { readonly halfWidth: number; readonly halfLength: number };
}

export type AvatarMode = 'idle' | 'strike' | 'deposit';

export class AvatarSim {
    public x: number;
    public z: number;
    public carrying = 0;
    public mode: AvatarMode = 'idle';
    public moveTargetX: number | null = null;
    public moveTargetZ: number | null = null;

    private actionTimer = 0;

    constructor(
        private readonly config: AvatarConfig,
        private readonly harvest: HarvestSim,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {
        this.x = config.spawn.x;
        this.z = config.spawn.z;
    }

    public commandMove(x: number, z: number): void {
        const bounds = this.config.bounds;
        this.moveTargetX = Math.max(-bounds.halfWidth, Math.min(bounds.halfWidth, x));
        this.moveTargetZ = Math.max(-bounds.halfLength, Math.min(bounds.halfLength, z));
    }

    public tick(deltaTime: number): void {
        if (this.moveTargetX !== null && this.moveTargetZ !== null) {
            const dx = this.moveTargetX - this.x;
            const dz = this.moveTargetZ - this.z;
            const distance = Math.hypot(dx, dz);
            const step = this.config.speed * deltaTime;
            if (distance <= step || distance < 0.02) {
                this.x = this.moveTargetX;
                this.z = this.moveTargetZ;
                this.moveTargetX = null;
                this.moveTargetZ = null;
            } else {
                this.x += (dx / distance) * step;
                this.z += (dz / distance) * step;
            }
        }

        if (this.carrying < this.config.capacity) {
            const vein = this.harvest.nearestStocked(this.x, this.z, this.config.actionRange);
            if (vein) {
                this.setMode('strike');
                this.actionTimer += deltaTime;
                while (this.actionTimer >= this.config.strikeInterval && vein.stock > 0 && this.carrying < this.config.capacity) {
                    this.actionTimer -= this.config.strikeInterval;
                    this.carrying += this.harvest.hit(vein, this.config.yieldPerStrike);
                    this.bus.emit('fx:strike', { x: vein.x, z: vein.z });
                }
                return;
            }
        }

        if (this.carrying > 0) {
            const depot = this.config.depot;
            if (Math.hypot(depot.x - this.x, depot.z - this.z) <= this.config.depositRange) {
                this.setMode('deposit');
                this.actionTimer += deltaTime;
                if (this.actionTimer >= this.config.depositTime) {
                    this.actionTimer = 0;
                    const amount = this.economy.deposit(this.carrying);
                    this.carrying = 0;
                    this.bus.emit('fx:deposit', { x: this.x, z: this.z, amount });
                }
                return;
            }
        }

        this.setMode('idle');
    }

    private setMode(mode: AvatarMode): void {
        if (this.mode !== mode) {
            this.mode = mode;
            this.actionTimer = 0;
        }
    }
}
