import { Action, BtNode, BtStatus, Condition, Repeat, Selector, Sequence } from '../../common/BehaviorTree';
import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';
import { HarvestSim, HarvestVein } from '../harvest/HarvestSim';

// 雇员模块（纯逻辑）：玩家购买获得的自动化。感知式行为树大脑：
// 满载回投 → 范围索敌并自动开采 → 有货无目标先回投 → 向矿区集结。
export interface WorkerCrewConfig {
    readonly spawn: { readonly x: number; readonly z: number };
    readonly depot: { readonly x: number; readonly z: number };
    readonly speed: number;
    readonly capacity: number;
    readonly strikeInterval: number;
    readonly yieldPerStrike: number;
    readonly depositTime: number;
    readonly actionRange: number;
    readonly detectRange: number;
}

export type CrewWorkerTask = 'rally' | 'approach' | 'strike' | 'toDepot' | 'deposit';

export interface CrewWorker {
    readonly id: number;
    x: number;
    z: number;
    carrying: number;
    task: CrewWorkerTask;
    actionTimer: number;
    targetVeinId: number | null;
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
        private readonly harvest: HarvestSim,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {}

    public hire(): CrewWorker {
        const worker: CrewWorker = {
            id: this.nextId,
            x: this.config.spawn.x + (this.nextId - 1) * 0.5,
            z: this.config.spawn.z,
            carrying: 0,
            task: 'rally',
            actionTimer: 0,
            targetVeinId: null,
        };
        this.nextId += 1;
        this.workers.push(worker);
        this.brains.set(worker.id, { tree: this.buildBrain(), context: { worker } });
        return worker;
    }

    public tick(deltaTime: number): void {
        for (const worker of this.workers) {
            const brain = this.brains.get(worker.id);
            brain?.tree.tick(brain.context, deltaTime);
        }
    }

    private buildBrain(): BtNode<WorkerContext> {
        return new Repeat(new Selector<WorkerContext>([
            new Sequence<WorkerContext>([
                new Condition(context => context.worker.carrying >= this.config.capacity),
                new Action((context, dt) => this.goToDepot(context.worker, dt)),
                new Action((context, dt) => this.deposit(context.worker, dt)),
            ]),
            new Sequence<WorkerContext>([
                new Action(context => this.acquire(context.worker)),
                new Action((context, dt) => this.approach(context.worker, dt)),
                new Action((context, dt) => this.strike(context.worker, dt)),
            ]),
            new Sequence<WorkerContext>([
                new Condition(context => context.worker.carrying > 0),
                new Action((context, dt) => this.goToDepot(context.worker, dt)),
                new Action((context, dt) => this.deposit(context.worker, dt)),
            ]),
            new Action((context, dt) => this.rally(context.worker, dt)),
        ]));
    }

    private acquire(worker: CrewWorker): BtStatus {
        const vein = this.harvest.nearestStocked(worker.x, worker.z, this.config.detectRange);
        if (!vein) {
            worker.targetVeinId = null;
            return BtStatus.Failure;
        }
        worker.targetVeinId = vein.id;
        return BtStatus.Success;
    }

    private approach(worker: CrewWorker, deltaTime: number): BtStatus {
        const vein = this.targetOf(worker);
        if (!vein || vein.stock <= 0) {
            return BtStatus.Failure;
        }
        worker.task = 'approach';
        if (Math.hypot(vein.x - worker.x, vein.z - worker.z) <= this.config.actionRange) {
            return BtStatus.Success;
        }
        this.moveToward(worker, vein.x, vein.z, deltaTime);
        return BtStatus.Running;
    }

    private strike(worker: CrewWorker, deltaTime: number): BtStatus {
        const vein = this.targetOf(worker);
        if (!vein || vein.stock <= 0) {
            worker.actionTimer = 0;
            return BtStatus.Success;
        }
        worker.task = 'strike';
        worker.actionTimer += deltaTime;
        while (worker.actionTimer >= this.config.strikeInterval && vein.stock > 0 && worker.carrying < this.config.capacity) {
            worker.actionTimer -= this.config.strikeInterval;
            worker.carrying += this.harvest.hit(vein, this.config.yieldPerStrike);
            this.bus.emit('fx:strike', { x: vein.x, z: vein.z });
        }
        if (worker.carrying >= this.config.capacity || vein.stock <= 0) {
            worker.actionTimer = 0;
            return BtStatus.Success;
        }
        return BtStatus.Running;
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
        const amount = this.economy.deposit(worker.carrying);
        worker.carrying = 0;
        this.bus.emit('fx:deposit', { x: worker.x, z: worker.z, amount });
        worker.task = 'rally';
        return BtStatus.Success;
    }

    private rally(worker: CrewWorker, deltaTime: number): BtStatus {
        worker.task = 'rally';
        const zone = this.harvest.nearestUnlockedZone(worker.x, worker.z);
        if (!zone) {
            return BtStatus.Success;
        }
        return this.moveToward(worker, zone.x, zone.z + 1.4, deltaTime) ? BtStatus.Success : BtStatus.Running;
    }

    private targetOf(worker: CrewWorker): HarvestVein | null {
        return this.harvest.veins.find(vein => vein.id === worker.targetVeinId) ?? null;
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
