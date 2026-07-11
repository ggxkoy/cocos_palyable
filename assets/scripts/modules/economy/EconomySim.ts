// 经济模块（纯逻辑）——双货币：
// 弹药：废料入库兑换（等级越高的废料换的子弹越多），防御射击按发消耗；
// 金币：只来自杀敌掉落（拾取即入账），用于雇佣与升级绳子。
export interface EconomyConfig {
    readonly ammoByKind: Readonly<Record<string, number>>;
    readonly ammoCap: number;
    readonly coinValue: number;
}

export class EconomySim {
    public gold = 0;
    public ammo = 0;

    constructor(private readonly config: EconomyConfig) {}

    // 一背包废料换弹药，返回换得的弹药数（不产金币）。
    public depositLoad(load: ReadonlyArray<string>): number {
        let gained = 0;
        for (const kind of load) {
            gained += this.config.ammoByKind[kind] ?? 1;
        }
        this.ammo = Math.min(this.config.ammoCap, this.ammo + gained);
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
