import { EventBus } from '../../framework/EventBus';
import { PickupSim } from '../pickups/PickupSim';

// 回收机模块（纯逻辑）：废料不再直接变成弹药计数——
// 入库的废料排队进机器，按加工节奏一件件变成【子弹包实体】堆在出料口
// （'ammo*' 系掉落物）。子弹包要主角走过去背上、送到前线炮塔才进弹池。
// 出料口堆满会停机（pileCap）：不去搬运，生产线就会憋住——搬运即压力。
// 约定：子弹包 kind 一律以 'ammo' 开头（主角/雇员/引导按这个前缀区分）。
export interface DepotConfig {
    readonly output: { readonly x: number; readonly z: number };
    readonly convertInterval: number;
    readonly pileCap: number;
    /** 废料 kind → 子弹包 kind（等级越高的废料出越值钱的包）。 */
    readonly scrapToPack: Readonly<Record<string, string>>;
}

export class DepotSim {
    private readonly queue: string[] = [];
    private timer = 0;
    private spawnCursor = 0;

    constructor(
        private readonly config: DepotConfig,
        private readonly pickups: PickupSim,
        private readonly bus: EventBus,
    ) {}

    /** 卸一背包废料进机器，返回实际收下的件数（不认识的种类原样拒收）。 */
    public enqueue(load: ReadonlyArray<string>): number {
        let accepted = 0;
        for (const kind of load) {
            if (this.config.scrapToPack[kind]) {
                this.queue.push(kind);
                accepted += 1;
            }
        }
        return accepted;
    }

    public get backlog(): number {
        return this.queue.length;
    }

    /** 出料口现存的子弹包数。 */
    public pileCount(): number {
        let count = 0;
        for (const pickup of this.pickups.pickups) {
            if (pickup.alive && pickup.kind.indexOf('ammo') === 0) {
                count += 1;
            }
        }
        return count;
    }

    public tick(deltaTime: number): void {
        if (this.queue.length === 0) {
            this.timer = 0;
            return;
        }
        if (this.pileCount() >= this.config.pileCap) {
            return; // 堆满停机，等人来搬。
        }
        this.timer += deltaTime;
        if (this.timer < this.config.convertInterval) {
            return;
        }
        this.timer = 0;
        const scrapKind = this.queue.shift()!;
        const packKind = this.config.scrapToPack[scrapKind];
        // 出料口环形错位堆放（确定性伪散布，视觉上像一堆）。
        this.spawnCursor += 1;
        const angle = this.spawnCursor * 2.4;
        const radius = 0.45 + (this.spawnCursor % 3) * 0.22;
        const x = this.config.output.x + Math.cos(angle) * radius;
        const z = this.config.output.z + Math.sin(angle) * radius * 0.7;
        this.pickups.spawn(packKind, x, z);
        this.bus.emit('depot:converted', { kind: packKind, x, z });
    }
}
