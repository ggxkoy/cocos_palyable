import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';

// 目标链模块（纯逻辑）：严格按顺序的购买链 + 阶段机。
// 每个循环闭合时下一个目标已在场上；终极目标（vault）由玩家亲手点开，
// 无任何自动推进。购买生效通过事件广播，由被拼接的模块各自响应。
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
    readonly boomDuration: number;
}

export class GoalChainSim {
    public phase: GoalPhase = 'guide';
    public vaultOpened = false;
    public readonly purchases: GoalPurchase[];
    // 站上目标牌的驻留进度（0..1），视觉层可用来画充能环。
    public dwellProgress = 0;

    private boomTimer = 0;
    private dwellTimer = 0;
    private presence: (() => { x: number; z: number }) | null = null;

    constructor(
        private readonly config: GoalChainConfig,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {
        this.purchases = config.purchases.map(entry => ({ ...entry, purchased: false }));
    }

    // 注入"谁在踩牌子"（通常是主角位置）；购买 = 站上当前目标牌短暂驻留。
    public attachPresence(probe: () => { x: number; z: number }): void {
        this.presence = probe;
    }

    public next(): GoalPurchase | null {
        return this.purchases.find(purchase => !purchase.purchased) ?? null;
    }

    public canAffordNext(): boolean {
        const next = this.next();
        return !!next && this.economy.canAfford(next.cost);
    }

    public tick(deltaTime: number): void {
        if (this.phase === 'boom') {
            this.boomTimer -= deltaTime;
            if (this.boomTimer <= 0) {
                this.phase = 'end';
                this.bus.emit('goal:end');
            }
            return;
        }

        if (this.phase !== 'guide' && this.phase !== 'manage') {
            return;
        }

        const next = this.next();
        const standing = this.presence?.();
        if (!next || !standing || !this.economy.canAfford(next.cost)) {
            this.resetDwell();
            return;
        }
        const radius = next.kind === 'vault' ? this.config.vaultRadius : this.config.padRadius;
        if (Math.hypot(next.x - standing.x, next.z - standing.z) > radius) {
            this.resetDwell();
            return;
        }

        this.dwellTimer += deltaTime;
        this.dwellProgress = Math.min(1, this.dwellTimer / this.config.dwellTime);
        if (this.dwellTimer < this.config.dwellTime) {
            return;
        }
        this.resetDwell();
        this.purchase(next);
    }

    private purchase(next: GoalPurchase): void {
        if (!this.economy.spend(next.cost)) {
            return;
        }
        next.purchased = true;
        if (next.kind === 'hire') {
            this.bus.emit('goal:hire', { id: next.id });
            if (this.phase === 'guide') {
                this.phase = 'manage';
            }
        } else if (next.kind === 'unlock') {
            this.bus.emit('goal:unlock', { id: next.id });
        } else {
            this.vaultOpened = true;
            this.phase = 'boom';
            this.boomTimer = this.config.boomDuration;
            this.bus.emit('goal:vault', { id: next.id });
        }
        this.bus.emit('goal:purchased', { id: next.id });
    }

    private resetDwell(): void {
        this.dwellTimer = 0;
        this.dwellProgress = 0;
    }
}
