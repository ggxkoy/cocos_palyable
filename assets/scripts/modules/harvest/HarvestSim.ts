// 采集模块（纯逻辑）：矿区/残骸与库存重生。谁来敲由外部单位决定，
// 本模块只负责目标注册、感知查询与命中结算。
export interface HarvestZone {
    readonly id: number;
    readonly x: number;
    readonly z: number;
    readonly yieldKind: string;
    unlocked: boolean;
}

export interface HarvestVein {
    readonly id: number;
    readonly zoneId: number;
    readonly x: number;
    readonly z: number;
    readonly yieldKind: string;
    stock: number;
    respawnTimer: number;
}

export interface HarvestConfig {
    readonly zones: ReadonlyArray<{ readonly id: number; readonly x: number; readonly z: number; readonly yieldKind: string }>;
    readonly veinOffsets: ReadonlyArray<{ readonly x: number; readonly z: number }>;
    readonly veinStock: number;
    readonly veinRespawn: number;
}

export class HarvestSim {
    public readonly zones: HarvestZone[];
    public readonly veins: HarvestVein[] = [];

    constructor(private readonly config: HarvestConfig) {
        this.zones = config.zones.map((zone, index) => ({
            id: zone.id,
            x: zone.x,
            z: zone.z,
            yieldKind: zone.yieldKind,
            unlocked: index === 0,
        }));
        let veinId = 1;
        for (const zone of config.zones) {
            for (const offset of config.veinOffsets) {
                this.veins.push({
                    id: veinId,
                    zoneId: zone.id,
                    x: zone.x + offset.x,
                    z: zone.z + offset.z,
                    yieldKind: zone.yieldKind,
                    stock: config.veinStock,
                    respawnTimer: 0,
                });
                veinId += 1;
            }
        }
    }

    public tick(deltaTime: number): void {
        for (const vein of this.veins) {
            if (vein.stock <= 0 && vein.respawnTimer > 0) {
                vein.respawnTimer -= deltaTime;
                if (vein.respawnTimer <= 0) {
                    vein.stock = this.config.veinStock;
                }
            }
        }
    }

    public isUnlocked(zoneId: number): boolean {
        return this.zones.find(zone => zone.id === zoneId)?.unlocked ?? false;
    }

    public unlockNextZone(): void {
        const locked = this.zones.find(zone => !zone.unlocked);
        if (locked) {
            locked.unlocked = true;
        }
    }

    public nearestStocked(x: number, z: number, range: number): HarvestVein | null {
        let best: HarvestVein | null = null;
        let bestDistance = range;
        for (const vein of this.veins) {
            if (vein.stock <= 0 || !this.isUnlocked(vein.zoneId)) {
                continue;
            }
            const distance = Math.hypot(vein.x - x, vein.z - z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = vein;
            }
        }
        return best;
    }

    public nearestUnlockedZone(x: number, z: number): HarvestZone | null {
        let best: HarvestZone | null = null;
        let bestDistance = Infinity;
        for (const zone of this.zones) {
            if (!zone.unlocked) {
                continue;
            }
            const distance = Math.hypot(zone.x - x, zone.z - z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = zone;
            }
        }
        return best;
    }

    // 命中一次：库存 -1，敲空进入重生倒计时；返回掉落物类型（金子/木材…）。
    public hit(vein: HarvestVein): string | null {
        if (vein.stock <= 0) {
            return null;
        }
        vein.stock -= 1;
        if (vein.stock <= 0) {
            vein.respawnTimer = this.config.veinRespawn;
        }
        return vein.yieldKind;
    }
}
