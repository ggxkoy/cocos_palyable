export enum CrewPhase {
    Guide = 'guide',
    Manage = 'manage',
    Boom = 'boom',
    End = 'end',
}

export type PurchaseKind = 'hire' | 'unlock' | 'vault';

export interface Purchase {
    readonly id: string;
    readonly kind: PurchaseKind;
    readonly cost: number;
    purchased: boolean;
}

export interface Zone {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    unlocked: boolean;
}

// 可被自动开采/攻击的目标：矿脉有库存，敲空后按计时重生。
// 战斗压力型案例里同一结构即敌人：stock=血量、respawn=刷怪。
export interface Vein {
    readonly id: number;
    readonly zoneId: number;
    readonly x: number;
    readonly y: number;
    stock: number;
    respawnTimer: number;
}

export type WorkerTask = 'rally' | 'approach' | 'strike' | 'toDepot' | 'deposit';

export type ChiefMode = 'idle' | 'strike' | 'deposit';

// 主角：移动完全由玩家驱动（点击目的地），停手即停在原地；
// 只有「范围内自动交互」（挨着矿脉自动开采、挨着仓库自动投递）是自动的。
export interface Chief {
    x: number;
    y: number;
    carrying: number;
    actionTimer: number;
    mode: ChiefMode;
    moveTargetX: number | null;
    moveTargetY: number | null;
}

export interface Worker {
    readonly id: number;
    x: number;
    y: number;
    carrying: number;
    task: WorkerTask;
    actionTimer: number;
    targetVeinId: number | null;
}
