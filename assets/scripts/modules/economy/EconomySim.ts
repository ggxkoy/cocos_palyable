// 经济模块（纯逻辑）：金币 + 弹药两条资源线。
// 入库时金币/弹药同时增长，防御演出按发消耗弹药。
export interface EconomyConfig {
    readonly goldPerBar: number;
    readonly ammoPerBar: number;
    readonly ammoCap: number;
}

export class EconomySim {
    public gold = 0;
    public ammo = 0;

    constructor(private readonly config: EconomyConfig) {}

    public deposit(bars: number): number {
        const amount = bars * this.config.goldPerBar;
        this.gold += amount;
        this.ammo = Math.min(this.config.ammoCap, this.ammo + bars * this.config.ammoPerBar);
        return amount;
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

    public consumeAmmo(count: number): void {
        this.ammo = Math.max(0, this.ammo - count);
    }
}
