export enum Match3Phase {
    Play = 'play',
    End = 'end',
}

export interface SwapResult {
    readonly valid: boolean;
    readonly cleared: readonly number[];
    readonly scoreGained: number;
}

export interface Match3Hint {
    readonly a: number;
    readonly b: number;
}
