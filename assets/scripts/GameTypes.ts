export enum PlayableState {
    Ready = 'ready',
    Running = 'running',
    Won = 'won',
    Failed = 'failed',
}

export interface LaneEnemy {
    readonly id: number;
    progress: number;
    health: number;
    readonly maxHealth: number;
    readonly speed: number;
}

export interface TowerSlot {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    occupied: boolean;
    cooldown: number;
}

export interface Projectile {
    x: number;
    y: number;
    targetId: number;
    lifetime: number;
}
