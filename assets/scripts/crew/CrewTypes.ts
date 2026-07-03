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

export interface Mine {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    unlocked: boolean;
}

export type WorkerTask = 'toMine' | 'harvest' | 'toDepot' | 'deposit';

export interface Worker {
    readonly id: number;
    x: number;
    y: number;
    carrying: number;
    task: WorkerTask;
    actionTimer: number;
    mineId: number;
    justDeposited: boolean;
}
