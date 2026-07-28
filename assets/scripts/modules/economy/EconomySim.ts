// 经济模块（纯逻辑）——双货币：
// 弹药：主角把子弹包背到炮塔交付才入池（supplyAmmo），防御射击按发消耗；
// 金币：只来自杀敌掉落（拾取即入账），用于雇佣与升级绳子。
export interface EconomyConfig {
    readonly ammoCap: number;
    readonly coinValue: number;
}

export class EconomySim {
    public gold = 0;
    public ammo = 0;

    constructor(private readonly config: EconomyConfig) {}

    // 子弹包送达炮塔：入弹池，返回实际入账数（有弹容上限）。
    public supplyAmmo(amount: number): number {
        const gained = Math.min(amount, this.config.ammoCap - this.ammo);
        this.ammo += gained;
        return gained;
    }

    // 捡到金币（敌人掉落）直接入账。
    public collectCoin(): number {
        this.gold += this.config.coinValue;
        return this.config.coinValue;
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
