export enum MergePhase {
    Play = 'play',
    End = 'end',
}

export interface MergeItem {
    readonly id: number;
    level: number;
}

export interface MergeHint {
    readonly from: number;
    readonly to: number;
}
