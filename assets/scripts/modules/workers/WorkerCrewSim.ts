import { Action, BtNode, BtStatus, Condition, Repeat, Selector, Sequence } from '../../common/BehaviorTree';
import { EventBus } from '../../framework/EventBus';
import { ScrapIntake } from '../avatar/AvatarSim';
import { EconomySim } from '../economy/EconomySim';
import { PickupSim } from '../pickups/PickupSim';
import { JobProvider } from '../work/JobProvider';

// 雇员模块（纯逻辑）：玩家购买获得的自动化。行为树大脑对接通用作业接口
// （打捞绳/矿脉都可以）：满载回投 → 找活干（接近→持续作业）→
// 有货无活先回投 → 向作业区集结。金币掉落顺路也捡（直接入账）。
// 分工：雇员只跑废料线（捞→卸进回收机）；子弹包（'ammo*'）不碰——
// 前线补给是主角的活。
export interface WorkerCrewConfig {
    readonly spawn: { readonly x: number; readonly z: number };
    readonly depot: { readonly x: number; readonly z: number };
    readonly rally: { readonly x: number; readonly z: number };
    readonly speed: number;
    readonly capacity: number;
    readonly depositTime: number;
    readonly workSearchRange: number;
    readonly detectRange: number;
    readonly pickupRange: number;
}

export type CrewWorkerTask = 'rally' | 'approach' | 'work' | 'toDepot' | 'deposit';

export interface CrewWorker {
    readonly id: number;
    x: number;
    z: number;
    readonly carried: string[];
    task: CrewWorkerTask;
    actionTimer: number;
    jobId: number | null;
}

interface WorkerContext {
    readonly worker: CrewWorker;
}

export class WorkerCrewSim {
    public readonly workers: CrewWorker[] = [];

    private readonly brains = new Map<number, { tree: BtNode<WorkerContext>; context: WorkerContext }>();
    private nextId = 1;

    constructor(
        private readonly config: WorkerCrewConfig,
        private readonly job: JobProvider,
        private readonly pickups: PickupSim,
        private readonly economy: EconomySim,
        private readonly depot: ScrapIntake,
        private readonly bus: EventBus,
    ) {}

    public hire(): CrewWorker {
        const worker: CrewWorker = {
            id: this.nextId,
            x: this.config.spawn.x + (this.nextId - 1) * 0.5,
            z: this.config.spawn.z,
            carried: [],
            task: 'rally',
            actionTimer: 0,
            jobId: null,
        };
        this.nextId += 1;
        this.workers.push(worker);
        this.brains.set(worker.id, { tree: this.buildBrain(), context: { worker } });
        return worker;
    }

    public tick(deltaTime: number): void {
        for (const worker of this.workers) {
            // 范围自动拾取：金币直接入账，废料背上；子弹包留给主角搬。
            const pickup = this.pickups.nearestAlive(worker.x, worker.z, this.config.pickupRange);
            if (pickup) {
                if (pickup.kind === 'gold') {
                    this.pickups.collect(pickup);
                    const value = this.economy.collectCoin();
                    this.bus.emit('fx:coin', { x: pickup.x, z: pickup.z, value });
                } else if (pickup.kind.indexOf('ammo') !== 0 && worker.carried.length < this.config.capacity) {
                    worker.carried.push(this.pickups.collect(pickup));
                }
            }
            const brain = this.brains.get(worker.id);
            brain?.tree.tick(brain.context, deltaTime);
        }
    }

    private buildBrain(): BtNode<WorkerContext> {
        return new Repeat(new Selector<WorkerContext>([
            new Sequence<WorkerContext>([
                new Condition(context => context.worker.carried.length >= this.config.capacity),
                new Action((context, dt) => this.goToDepot(context.worker, dt)),
                new Action((context, dt) => this.deposit(context.worker, dt)),
            ]),
            new Sequence<WorkerContext>([
                new Action(context => this.acquire(context.worker)),
                new Action((context, dt) => this.approach(context.worker, dt)),
                new Action((context, dt) => this.workOn(context.worker, dt)),
            ]),
            new Sequence<WorkerContext>([
                new Condition(context => context.worker.carried.length > 0),
                new Action((context, dt) => this.goToDepot(context.worker, dt)),
                new Action((context, dt) => this.deposit(context.worker, dt)),
            ]),
            new Action((context, dt) => this.rally(context.worker, dt)),
        ]));
    }

    private unitKey(worker: CrewWorker): string {
        return `worker-${worker.id}`;
    }

    private acquire(worker: CrewWorker): BtStatus {
        const job = this.job.nearestJob(worker.x, worker.z, this.config.detectRange);
        if (!job) {
            worker.jobId = null;
            return BtStatus.Failure;
        }
        worker.jobId = job.id;
        return BtStatus.Success;
    }

    private approach(worker: CrewWorker, deltaTime: number): BtStatus {
        if (worker.jobId === null) {
            return BtStatus.Failure;
        }
        if (this.job.canWork(this.unitKey(worker), worker.jobId, worker.x, worker.z)) {
            return BtStatus.Success;
        }
        worker.task = 'approach';
        const job = this.job.nearestJob(worker.x, worker.z, this.config.detectRange);
        if (!job || job.id !== worker.jobId) {
            // 目标丢失（被抢/消失），重新找活。
            worker.jobId = null;
            return BtStatus.Failure;
        }
        this.moveToward(worker, job.x, job.z, deltaTime);
        return BtStatus.Running;
    }

    private workOn(worker: CrewWorker, deltaTime: number): BtStatus {
        if (worker.jobId === null) {
            return BtStatus.Failure;
        }
        worker.task = 'work';
        const result = this.job.work(this.unitKey(worker), worker.jobId, worker.x, worker.z, deltaTime);
        if (result === 'working') {
            return BtStatus.Running;
        }
        worker.jobId = null;
        return result === 'done' ? BtStatus.Success : BtStatus.Failure;
    }

    private goToDepot(worker: CrewWorker, deltaTime: number): BtStatus {
        worker.task = 'toDepot';
        const depot = this.config.depot;
        return this.moveToward(worker, depot.x, depot.z, deltaTime) ? BtStatus.Success : BtStatus.Running;
    }

    private deposit(worker: CrewWorker, deltaTime: number): BtStatus {
        worker.task = 'deposit';
        worker.actionTimer += deltaTime;
        if (worker.actionTimer < this.config.depositTime) {
            return BtStatus.Running;
        }
        worker.actionTimer = 0;
        const accepted = this.depot.enqueue(worker.carried);
        worker.carried.length = 0;
        this.bus.emit('fx:deposit', { x: worker.x, z: worker.z, count: accepted });
        worker.task = 'rally';
        return BtStatus.Success;
    }

    private rally(worker: CrewWorker, deltaTime: number): BtStatus {
        worker.task = 'rally';
        const rally = this.config.rally;
        return this.moveToward(worker, rally.x, rally.z, deltaTime) ? BtStatus.Success : BtStatus.Running;
    }

    private moveToward(unit: { x: number; z: number }, targetX: number, targetZ: number, deltaTime: number): boolean {
        const dx = targetX - unit.x;
        const dz = targetZ - unit.z;
        const distance = Math.hypot(dx, dz);
        const step = this.config.speed * deltaTime;
        if (distance <= step || distance < 0.02) {
            unit.x = targetX;
            unit.z = targetZ;
            return true;
        }
        unit.x += (dx / distance) * step;
        unit.z += (dz / distance) * step;
        return false;
    }
}
