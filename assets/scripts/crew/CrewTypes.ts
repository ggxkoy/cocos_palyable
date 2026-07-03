export enum CrewPhase {
    Guide = 'guide',
    Manage = 'manage',
    Boom = 'boom',
    End = 'end',
}

export type PurchaseKind = 'hire' | 'unlock';

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

export interface Worker {
    readonly id: number;
    x: number;
    y: number;
    carrying: number;
    task: WorkerTask;
    actionTimer: number;
    targetVeinId: number | null;
}
