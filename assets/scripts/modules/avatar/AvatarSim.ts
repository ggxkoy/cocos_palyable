import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';
import { HarvestSim } from '../harvest/HarvestSim';

// 主角模块（纯逻辑）。操作归属：移动由虚拟摇杆方向驱动，
// 松手即停在原地，绝无自动走位；仅有「范围内自动交互」
// （挨着残骸自动拉拽、挨着回收站自动投递）。
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
    public inputX = 0;
    public inputZ = 0;

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
