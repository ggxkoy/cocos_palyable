// 经济模块（纯逻辑）：金币 + 弹药两条资源线。
// 背上的道具按类型计价（金子/木材价值不同），入库同时补弹药；
// 防御射击按发消耗弹药，没弹药炮塔就停火（弹药危机感的来源）。
export interface EconomyConfig {
    readonly valueByKind: Readonly<Record<string, number>>;
    readonly ammoPerItem: number;
    readonly ammoCap: number;
}

export class EconomySim {
    public gold = 0;
    public ammo = 0;

    constructor(private readonly config: EconomyConfig) {}

    // 把一背包类型化道具换成金币与弹药，返回换得的金币数。
    public depositLoad(load: ReadonlyArray<string>): number {
        let value = 0;
        for (const kind of load) {
            value += this.config.valueByKind[kind] ?? 1;
        }
        this.gold += value;
        this.ammo = Math.min(this.config.ammoCap, this.ammo + load.length * this.config.ammoPerItem);
        return value;
    }

    public canAfford(cost: number): boolean {
        return this.gold >= cost;
    }

    public spend(cost: number): boolean {
        if (!this.canAfford(cost)) {
            return false;
        }
        this.gold -= cost;
        return true;
    }

    public hasAmmo(): boolean {
        return this.ammo > 0;
    }

    public consumeAmmo(count: number): void {
        this.ammo = Math.max(0, this.ammo - count);
    }
}
