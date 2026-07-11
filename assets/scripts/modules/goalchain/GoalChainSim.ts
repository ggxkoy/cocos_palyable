import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';

// 目标链模块（纯逻辑）——非线性版：
// 所有目标牌开局全部在场，玩家站上任意一块付得起的牌即可驻留购买，
// 顺序不做强制，由价格大小关系自然引导（终极目标最贵）。
// 阶段推进全部由状态/事件驱动：vault 购买进入 boom，
// 结算（end）由外部在「敌潮清场」时调用 finish()——没有任何秒表事件。
export type GoalPhase = 'guide' | 'manage' | 'boom' | 'end';

export type GoalKind = 'hire' | 'unlock' | 'vault';

export interface GoalPurchase {
    readonly id: string;
    readonly kind: GoalKind;
    readonly cost: number;
    readonly x: number;
    readonly z: number;
    purchased: boolean;
}

export interface GoalChainConfig {
    readonly purchases: ReadonlyArray<{
        readonly id: string;
        readonly kind: GoalKind;
        readonly cost: number;
        readonly x: number;
        readonly z: number;
    }>;
    readonly padRadius: number;
    readonly vaultRadius: number;
    readonly dwellTime: number;
}

export class GoalChainSim {
    public phase: GoalPhase = 'guide';
    public vaultOpened = false;
    public won = true;
    // 对标案规则：失败后可重新挑战 1 次。
    public retriesLeft = 1;
    public readonly purchases: GoalPurchase[];
    // 当前驻留充能的牌与进度（0..1），视觉层可画充能环。
    public dwellProgress = 0;
    public dwellPurchaseId: string | null = null;

    private dwellTimer = 0;
    private presence: (() => { x: number; z: number }) | null = null;
    private readonly requirements = new Map<string, () => boolean>();

    constructor(
        private readonly config: GoalChainConfig,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {
        this.purchases = config.purchases.map(entry => ({ ...entry, purchased: false }));
    }

    // 注入"谁在踩牌子"（通常是主角位置）。
    public attachPresence(probe: () => { x: number; z: number }): void {
        this.presence = probe;
    }

    // 给某个购买挂状态门槛（如：打捞大飞机需要满级绳子）。
    public attachRequirement(purchaseId: string, predicate: () => boolean): void {
        this.requirements.set(purchaseId, predicate);
    }

    public eligible(purchase: GoalPurchase): boolean {
        if (purchase.purchased) {
            return false;
        }
        return this.requirements.get(purchase.id)?.() ?? true;
    }

    // 推荐目标：最便宜的未购项（引导与 HUD 用），不构成强制顺序。
    public next(): GoalPurchase | null {
        let best: GoalPurchase | null = null;
        for (const purchase of this.purchases) {
            if (!this.eligible(purchase)) {
                continue;
            }
            if (!best || purchase.cost < best.cost) {
                best = purchase;
            }
        }
        return best;
    }

    public canAffordNext(): boolean {
        const next = this.next();
        return !!next && this.economy.canAfford(next.cost);
    }

    // 同一位置可能排多个购买（如两次雇佣共用一块牌）：取该位置最便宜的未购项。
    public cheapestAt(x: number, z: number): GoalPurchase | null {
        let best: GoalPurchase | null = null;
        for (const purchase of this.purchases) {
            if (!this.eligible(purchase) || purchase.x !== x || purchase.z !== z) {
                continue;
            }
            if (!best || purchase.cost < best.cost) {
                best = purchase;
            }
        }
        return best;
    }

    // 外部（敌潮清场事件）调用：结束演出，出胜利结算。
    public finish(): void {
        if (this.phase !== 'boom') {
            return;
        }
        this.phase = 'end';
        this.won = true;
        this.bus.emit('goal:end');
    }

    // 围墙被击破：失败结算（可复活重试）。
    public fail(): void {
        if (this.phase === 'end') {
            return;
        }
        this.phase = 'end';
        this.won = false;
        this.bus.emit('goal:fail');
    }

    // 复活：回到失败前的阶段继续玩。
    public revive(): boolean {
        if (this.phase !== 'end' || this.won || this.retriesLeft <= 0) {
            return false;
        }
        this.retriesLeft -= 1;
        this.won = true;
        this.phase = this.vaultOpened ? 'boom' : 'manage';
        this.bus.emit('goal:revive');
        return true;
    }

    public tick(deltaTime: number): void {
        if (this.phase !== 'guide' && this.phase !== 'manage') {
            return;
        }

        const standing = this.presence?.();
        if (!standing) {
            this.resetDwell();
            return;
        }

        // 非线性：找玩家脚下最近的、付得起的未购牌（任何一块都行）。
        let target: GoalPurchase | null = null;
        let bestDistance = Infinity;
        for (const purchase of this.purchases) {
            if (!this.eligible(purchase) || !this.economy.canAfford(purchase.cost)) {
                continue;
            }
            const radius = purchase.kind === 'vault' ? this.config.vaultRadius : this.config.padRadius;
            const distance = Math.hypot(purchase.x - standing.x, purchase.z - standing.z);
            if (distance <= radius && distance < bestDistance) {
                bestDistance = distance;
                target = purchase;
            }
        }
        // 同位置取最便宜的一项。
        if (target) {
            target = this.cheapestAt(target.x, target.z) ?? target;
        }

        if (!target) {
            this.resetDwell();
            return;
        }
        if (this.dwellPurchaseId !== target.id) {
            this.dwellPurchaseId = target.id;
            this.dwellTimer = 0;
        }

        this.dwellTimer += deltaTime;
        this.dwellProgress = Math.min(1, this.dwellTimer / this.config.dwellTime);
        if (this.dwellTimer < this.config.dwellTime) {
            return;
        }
        this.resetDwell();
        this.purchase(target);
    }

    private purchase(target: GoalPurchase): void {
        if (!this.economy.spend(target.cost)) {
            return;
        }
        target.purchased = true;
        if (target.kind === 'hire') {
            this.bus.emit('goal:hire', { id: target.id });
        } else if (target.kind === 'unlock') {
            this.bus.emit('goal:unlock', { id: target.id });
        } else {
            this.vaultOpened = true;
            this.phase = 'boom';
            this.bus.emit('goal:vault', { id: target.id });
        }
        if (this.phase === 'guide') {
            this.phase = 'manage';
        }
        this.bus.emit('goal:purchased', { id: target.id });
    }

    private resetDwell(): void {
        this.dwellTimer = 0;
        this.dwellProgress = 0;
        this.dwellPurchaseId = null;
    }
}
