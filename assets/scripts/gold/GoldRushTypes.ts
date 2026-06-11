export enum GoldRushPhase {
    Collect = 'collect',
    Upgrade = 'upgrade',
    Battle = 'battle',
    End = 'end',
}

export interface GoldCrate {
    readonly id: number;
    collected: boolean;
}

export interface GoldRushSnapshot {
    readonly phase: GoldRushPhase;
    readonly gold: number;
    readonly upgradeLevel: number;
    readonly battleProgress: number;
}
