export enum RunnerPhase {
    Running = 'running',
    Won = 'won',
    Failed = 'failed',
}

export type LaneIndex = -1 | 0 | 1;

export type RoadItemKind = 'obstacle' | 'coin';

export interface RoadItem {
    readonly id: number;
    readonly lane: LaneIndex;
    readonly kind: RoadItemKind;
    progress: number;
}
