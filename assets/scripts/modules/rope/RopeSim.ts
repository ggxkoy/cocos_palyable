import { EventBus } from '../../framework/EventBus';
import { JobProvider, WorkJob, WorkResult } from '../work/JobProvider';

// 打捞绳模块（纯逻辑，实现 JobProvider）：
// 泥潭里沉着分级残骸（小件浅处、大件深处）。绳子有等级：长度决定够得着多深，
// 质量决定拉得动几级物体。拉拽是持续作业（大件更久），拉出后在拉拽者脚边
// 散出对应等级的废料（rope:salvaged 事件，由拼装层转成掉落物）。
// 升级绳子花金币（金币只来自杀敌）——这就是 杀敌→金币→绳子→大件→子弹 的正循环。
export interface RopeTierSpec {
    readonly tier: number;
    readonly pullTime: number;
    readonly scrapKind: string;
    readonly scrapCount: number;
}

export type WreckState = 'submerged' | 'pulling' | 'respawning';

export interface RopeWreck {
    readonly id: number;
    readonly tier: number;
    readonly x: number;
    readonly z: number;
    state: WreckState;
    progress: number;
    respawnTimer: number;
    pullerId: string | null;
    pullerX: number;
    pullerZ: number;
}

export interface RopeConfig {
    readonly wrecks: ReadonlyArray<{ readonly tier: number; readonly x: number; readonly z: number }>;
    readonly tierSpecs: ReadonlyArray<RopeTierSpec>;
    // 每级绳长（索引 = 等级-1）：决定站在岸边能够到多深。
    readonly ranges: ReadonlyArray<number>;
    readonly respawnTime: number;
}

export class RopeSim implements JobProvider {
    public level = 1;
    public readonly wrecks: RopeWreck[] = [];

    private readonly pulledThisTick = new Set<number>();

    constructor(
        private readonly config: RopeConfig,
        private readonly bus: EventBus,
    ) {
        config.wrecks.forEach((entry, index) => {
            this.wrecks.push({
                id: index + 1,
                tier: entry.tier,
                x: entry.x,
                z: entry.z,
                state: 'submerged',
                progress: 0,
                respawnTimer: 0,
                pullerId: null,
                pullerX: entry.x,
                pullerZ: entry.z,
            });
        });
    }

    public get maxLevel(): number {
        return this.config.ranges.length;
    }

    public get range(): number {
        return this.config.ranges[Math.min(this.level, this.maxLevel) - 1];
    }

    public upgrade(): void {
        this.level = Math.min(this.maxLevel, this.level + 1);
    }

    public specOf(tier: number): RopeTierSpec {
        return this.config.tierSpecs.find(spec => spec.tier === tier) ?? this.config.tierSpecs[0];
    }

    // ---- JobProvider ----

    public nearestJob(x: number, z: number, range: number): WorkJob | null {
        let best: RopeWreck | null = null;
        let bestDistance = Math.min(range, this.range);
        for (const wreck of this.wrecks) {
            if (wreck.state === 'respawning' || wreck.tier > this.level) {
                continue;
            }
            if (wreck.state === 'pulling' && wreck.pullerId !== null) {
                continue;
            }
            const distance = Math.hypot(wreck.x - x, wreck.z - z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = wreck;
            }
        }
        return best ? { id: best.id, x: best.x, z: best.z } : null;
    }

    public canWork(unitKey: string, jobId: number, x: number, z: number): boolean {
        const wreck = this.wrecks.find(item => item.id === jobId);
        if (!wreck || wreck.state === 'respawning' || wreck.tier > this.level) {
            return false;
        }
        if (wreck.pullerId !== null && wreck.pullerId !== unitKey) {
            return false;
        }
        return Math.hypot(wreck.x - x, wreck.z - z) <= this.range;
    }

    public work(unitKey: string, jobId: number, x: number, z: number, deltaTime: number): WorkResult {
        const wreck = this.wrecks.find(item => item.id === jobId);
        if (!wreck || !this.canWork(unitKey, jobId, x, z)) {
            return 'lost';
        }
        wreck.state = 'pulling';
        wreck.pullerId = unitKey;
        wreck.pullerX = x;
        wreck.pullerZ = z;
        this.pulledThisTick.add(wreck.id);

        const spec = this.specOf(wreck.tier);
        wreck.progress += deltaTime / spec.pullTime;
        this.bus.emit('rope:pulling', { wreckId: wreck.id });
        if (wreck.progress < 1) {
            return 'working';
        }

        // 拉出：废料散在拉拽者脚边，残骸进入重生（泥潭捞不完）。
        this.bus.emit('rope:salvaged', {
            tier: wreck.tier,
            scrapKind: spec.scrapKind,
            scrapCount: spec.scrapCount,
            x,
            z,
        });
        wreck.state = 'respawning';
        wreck.respawnTimer = this.config.respawnTime;
        wreck.progress = 0;
        wreck.pullerId = null;
        return 'done';
    }

    public release(unitKey: string): void {
        for (const wreck of this.wrecks) {
            if (wreck.pullerId === unitKey) {
                wreck.pullerId = null;
                if (wreck.state === 'pulling') {
                    wreck.state = 'submerged';
                }
            }
        }
    }

    public tick(deltaTime: number): void {
        for (const wreck of this.wrecks) {
            if (wreck.state === 'respawning') {
                wreck.respawnTimer -= deltaTime;
                if (wreck.respawnTimer <= 0) {
                    wreck.state = 'submerged';
                    wreck.progress = 0;
                }
                continue;
            }
            // 这一帧没人拉 → 松绳（进度保留，可回来继续）。
            if (wreck.state === 'pulling' && !this.pulledThisTick.has(wreck.id)) {
                wreck.state = 'submerged';
                wreck.pullerId = null;
            }
        }
        this.pulledThisTick.clear();
    }
}
