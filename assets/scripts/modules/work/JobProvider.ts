// 通用作业接口（纯逻辑）：主角/雇员的"干活"能力对接点。
// 打捞绳（RopeSim）、矿脉敲击等都可实现它——单位不关心活的种类。
export interface WorkJob {
    readonly id: number;
    readonly x: number;
    readonly z: number;
}

export type WorkResult = 'working' | 'done' | 'lost';

export interface JobProvider {
    // 单位可见范围内最近的可认领作业。
    nearestJob(x: number, z: number, range: number): WorkJob | null;
    // 单位当前位置是否够得着这份活（认领权也在这里判定）。
    canWork(unitKey: string, jobId: number, x: number, z: number): boolean;
    // 干一帧活：working=继续，done=完成，lost=作业失效/被抢。
    work(unitKey: string, jobId: number, x: number, z: number, deltaTime: number): WorkResult;
    // 单位离开时释放认领。
    release(unitKey: string): void;
}
