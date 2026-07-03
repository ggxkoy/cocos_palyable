import { Action, BtNode, BtStatus, Repeat, Sequence } from '../common/BehaviorTree';
import { CREW_CONFIG } from './CrewConfig';
import { CrewPhase, Mine, Purchase, Worker } from './CrewTypes';

const CONFIG = CREW_CONFIG;

export interface DepositEvent {
    readonly x: number;
    readonly y: number;
    readonly amount: number;
}

interface WorkerContext {
    readonly worker: Worker;
}

export class CrewModel {
    public phase: CrewPhase = CrewPhase.Guide;
    public gold: number = CONFIG.startGold;
    public elapsed = 0;
    public readonly workers: Worker[] = [];
    public readonly mines: Mine[] = CONFIG.stations.mines.map((mine, index) => ({
        id: mine.id,
        x: mine.x,
        y: mine.y,
        unlocked: index === 0,
    }));
    public readonly purchases: Purchase[] = CONFIG.purchases.map(entry => ({
        id: entry.id,
        kind: entry.kind,
        cost: entry.cost,
        purchased: false,
    }));

    private readonly trees = new Map<number, { tree: BtNode<WorkerContext>; context: WorkerContext }>();
    private readonly depositEvents: DepositEvent[] = [];
    private nextWorkerId = 1;
    private boomTimer = 0;

    // 引导始终指向下一个待购买项；结算前购买是玩家唯一的操作。
    public nextPurchase(): Purchase | null {
        return this.purchases.find(purchase => !purchase.purchased) ?? null;
    }

    public canAfford(purchase: Purchase): boolean {
        return this.gold >= purchase.cost;
    }

    public tapPurchase(purchaseId: string): boolean {
        if (this.phase !== CrewPhase.Guide && this.phase !== CrewPhase.Manage) {
            return false;
        }

        const purchase = this.purchases.find(item => item.id === purchaseId);
        if (!purchase || purchase.purchased || !this.canAfford(purchase)) {
            return false;
        }

        purchase.purchased = true;
        this.gold -= purchase.cost;

        if (purchase.kind === 'hire') {
            this.spawnWorker();
        } else {
            const locked = this.mines.find(mine => !mine.unlocked);
            if (locked) {
                locked.unlocked = true;
            }
        }

        if (this.phase === CrewPhase.Guide && this.workers.length > 0) {
            this.phase = CrewPhase.Manage;
        }
        return true;
    }

    public update(deltaTime: number): void {
        if (this.phase === CrewPhase.End) {
            return;
        }

        this.elapsed += deltaTime;

        if (this.phase === CrewPhase.Boom) {
            this.boomTimer -= deltaTime;
            this.tickWorkers(deltaTime);
            if (this.boomTimer <= 0) {
                this.phase = CrewPhase.End;
            }
            return;
        }

        this.tickWorkers(deltaTime);

        const allPurchased = this.purchases.every(purchase => purchase.purchased);
        const boomReady = allPurchased && this.gold >= CONFIG.boomGoldTarget;
        if (boomReady || this.elapsed >= CONFIG.maxDuration) {
            this.phase = CrewPhase.Boom;
            this.boomTimer = CONFIG.boomDuration;
        }
    }

    public drainDepositEvents(): DepositEvent[] {
        return this.depositEvents.splice(0, this.depositEvents.length);
    }

    private tickWorkers(deltaTime: number): void {
        for (const worker of this.workers) {
            const entry = this.trees.get(worker.id);
            entry?.tree.tick(entry.context, deltaTime);
        }
    }

    private spawnWorker(): void {
        const spawn = CONFIG.stations.workerSpawn;
        const worker: Worker = {
            id: this.nextWorkerId,
            x: spawn.x + (this.nextWorkerId - 1) * 18,
            y: spawn.y,
            carrying: 0,
            task: 'toMine',
            actionTimer: 0,
            mineId: this.mines[0].id,
            justDeposited: false,
        };
        this.nextWorkerId += 1;
        this.workers.push(worker);
        this.trees.set(worker.id, {
            tree: this.buildWorkerTree(),
            context: { worker },
        });
    }

    // 工人小循环：采集 → 搬运 → 入库，行为树无限循环遍历。
    private buildWorkerTree(): BtNode<WorkerContext> {
        return new Repeat(new Sequence<WorkerContext>([
            new Action((context, dt) => this.goToMine(context.worker, dt)),
            new Action((context, dt) => this.harvest(context.worker, dt)),
            new Action((context, dt) => this.goToDepot(context.worker, dt)),
            new Action((context, dt) => this.deposit(context.worker, dt)),
        ]));
    }

    private goToMine(worker: Worker, deltaTime: number): BtStatus {
        if (worker.task !== 'toMine') {
            worker.task = 'toMine';
            worker.mineId = this.pickMine(worker).id;
        }
        const mine = this.mines.find(item => item.id === worker.mineId) ?? this.mines[0];
        return this.moveToward(worker, mine.x, mine.y + 46, deltaTime)
            ? BtStatus.Success
            : BtStatus.Running;
    }

    private harvest(worker: Worker, deltaTime: number): BtStatus {
        worker.task = 'harvest';
        worker.actionTimer += deltaTime;
        while (worker.actionTimer >= CONFIG.harvestTimePerBar && worker.carrying < CONFIG.workerCapacity) {
            worker.actionTimer -= CONFIG.harvestTimePerBar;
            worker.carrying += 1;
        }
        if (worker.carrying >= CONFIG.workerCapacity) {
            worker.actionTimer = 0;
            return BtStatus.Success;
        }
        return BtStatus.Running;
    }

    private goToDepot(worker: Worker, deltaTime: number): BtStatus {
        worker.task = 'toDepot';
        const depot = CONFIG.stations.depot;
        return this.moveToward(worker, depot.x, depot.y - 8, deltaTime)
            ? BtStatus.Success
            : BtStatus.Running;
    }

    private deposit(worker: Worker, deltaTime: number): BtStatus {
        worker.task = 'deposit';
        worker.actionTimer += deltaTime;
        if (worker.actionTimer < CONFIG.depositTime) {
            return BtStatus.Running;
        }
        worker.actionTimer = 0;

        const amount = worker.carrying * CONFIG.goldPerBar;
        worker.carrying = 0;
        this.gold += amount;
        worker.justDeposited = true;
        this.depositEvents.push({ x: worker.x, y: worker.y, amount });
        worker.task = 'toMine';
        worker.mineId = this.pickMine(worker).id;
        return BtStatus.Success;
    }

    // 简单分流：按工人 id 与趟次错开矿点，避免全挤在一处。
    private pickMine(worker: Worker): Mine {
        const unlocked = this.mines.filter(mine => mine.unlocked);
        return unlocked[worker.id % unlocked.length];
    }

    private moveToward(worker: Worker, targetX: number, targetY: number, deltaTime: number): boolean {
        const dx = targetX - worker.x;
        const dy = targetY - worker.y;
        const distance = Math.hypot(dx, dy);
        const step = CONFIG.workerSpeed * deltaTime;
        if (distance <= step || distance < 1) {
            worker.x = targetX;
            worker.y = targetY;
            return true;
        }
        worker.x += (dx / distance) * step;
        worker.y += (dy / distance) * step;
        return false;
    }
}
