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
    readonly boomDuration: number;
}

export class GoalChainSim {
    public phase: GoalPhase = 'guide';
    public vaultOpened = false;
    public readonly purchases: GoalPurchase[];

    private boomTimer = 0;

    constructor(
        private readonly config: GoalChainConfig,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {
        this.purchases = config.purchases.map(entry => ({ ...entry, purchased: false }));
    }

    public next(): GoalPurchase | null {
        return this.purchases.find(purchase => !purchase.purchased) ?? null;
    }

    public canAffordNext(): boolean {
        const next = this.next();
        return !!next && this.economy.canAfford(next.cost);
    }

    // 点击世界坐标：只允许命中「当前环节」的目标牌/大锚点。
    public tapAt(x: number, z: number): boolean {
        if (this.phase !== 'guide' && this.phase !== 'manage') {
            return false;
        }
        const next = this.next();
        if (!next) {
            return false;
        }
        const radius = next.kind === 'vault' ? this.config.vaultRadius : this.config.padRadius;
        if (Math.hypot(next.x - x, next.z - z) > radius) {
            return false;
        }
        if (!this.economy.spend(next.cost)) {
            return false;
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
        return true;
    }

    public tick(deltaTime: number): void {
        if (this.phase !== 'boom') {
            return;
        }
        this.boomTimer -= deltaTime;
        if (this.boomTimer <= 0) {
            this.phase = 'end';
            this.bus.emit('goal:end');
        }
    }
}
