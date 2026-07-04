import { Action, BtNode, BtStatus, Condition, Repeat, Selector, Sequence } from '../common/BehaviorTree';
import { CREW_CONFIG } from './CrewConfig';
import { Chief, CrewPhase, HordeEnemy, Purchase, Vein, Worker, Zone } from './CrewTypes';

const CONFIG = CREW_CONFIG;

export interface FxEvent {
    readonly x: number;
    readonly y: number;
    readonly amount: number;
}

export interface FireEvent {
    readonly fromX: number;
    readonly fromY: number;
    readonly toX: number;
    readonly toY: number;
}

interface WorkerContext {
    readonly worker: Worker;
}

export class CrewModel {
    public phase: CrewPhase = CrewPhase.Guide;
    public gold: number = CONFIG.startGold;
    public elapsed = 0;
    public readonly workers: Worker[] = [];
    public readonly zones: Zone[] = CONFIG.stations.zones.map((zone, index) => ({
        id: zone.id,
        x: zone.x,
        y: zone.y,
        unlocked: index === 0,
    }));
    public readonly veins: Vein[] = [];
    public readonly purchases: Purchase[] = CONFIG.purchases.map(entry => ({
        id: entry.id,
        kind: entry.kind,
        cost: entry.cost,
        purchased: false,
    }));

    public vaultOpened = false;
    // 弹药随入库上涨、随炮塔射击消耗（策划案差异点 #2，视觉经济）。
    public ammo = 0;
    public readonly horde: HordeEnemy[] = [];

    // 主角：移动只响应玩家指令，没有指令就停在原地。
    public readonly chief: Chief = {
        x: CONFIG.stations.workerSpawn.x,
        y: CONFIG.stations.workerSpawn.y,
        carrying: 0,
        actionTimer: 0,
        mode: 'idle',
        moveTargetX: null,
        moveTargetY: null,
    };

    private readonly trees = new Map<number, { tree: BtNode<WorkerContext>; context: WorkerContext }>();
    private readonly depositEvents: FxEvent[] = [];
    private readonly strikeEvents: FxEvent[] = [];
    private readonly fireEvents: FireEvent[] = [];
    private nextWorkerId = 1;
    private nextEnemyId = 1;
    private turretIndex = 0;
    private fireTimer = 0;
    private boomTimer = 0;

    constructor() {
        let veinId = 1;
        for (const zone of CONFIG.stations.zones) {
            for (const offset of CONFIG.stations.veinOffsets) {
                this.veins.push({
                    id: veinId,
                    zoneId: zone.id,
                    x: zone.x + offset.x,
                    y: zone.y + offset.y,
                    stock: CONFIG.veinStock,
                    respawnTimer: 0,
                });
                veinId += 1;
            }
        }
    }

    // 引导始终指向下一个待购买项；结算前购买是玩家唯一的操作。
    public nextPurchase(): Purchase | null {
        return this.purchases.find(purchase => !purchase.purchased) ?? null;
    }

    public canAfford(purchase: Purchase): boolean {
        return this.gold >= purchase.cost;
    }

    // 目标链严格按顺序：只有「下一个目标」可被购买，保证每个循环闭合时
    // 玩家面前立刻有新目标，而不是重复上一个循环。
    public tapPurchase(purchaseId: string): boolean {
        if (this.phase !== CrewPhase.Guide && this.phase !== CrewPhase.Manage) {
            return false;
        }

        const purchase = this.nextPurchase();
        if (!purchase || purchase.id !== purchaseId || !this.canAfford(purchase)) {
            return false;
        }

        purchase.purchased = true;
        this.gold -= purchase.cost;

        if (purchase.kind === 'hire') {
            this.spawnWorker();
        } else if (purchase.kind === 'unlock') {
            const locked = this.zones.find(zone => !zone.unlocked);
            if (locked) {
                locked.unlocked = true;
            }
        } else {
            // 终极目标：打开金库即进入繁荣结算。
            this.openVault();
        }

        if (this.phase === CrewPhase.Guide && this.workers.length > 0) {
            this.phase = CrewPhase.Manage;
        }
        return true;
    }

    // 玩家点击地面下达移动指令；这是主角位移的唯一来源。
    public commandMove(webX: number, webY: number): void {
        if (this.phase === CrewPhase.End) {
            return;
        }
        this.chief.moveTargetX = Math.max(24, Math.min(366, webX));
        this.chief.moveTargetY = Math.max(60, Math.min(800, webY));
    }

    public update(deltaTime: number): void {
        if (this.phase === CrewPhase.End) {
            return;
        }

        this.elapsed += deltaTime;
        this.tickVeins(deltaTime);
        this.tickChief(deltaTime);
        this.tickWorkers(deltaTime);

        if (this.phase === CrewPhase.Boom) {
            this.tickDefense(deltaTime);
            this.boomTimer -= deltaTime;
            if (this.boomTimer <= 0) {
                this.phase = CrewPhase.End;
            }
        }
        // 没有任何自动推进：结算只能由玩家亲手打捞大飞机（vault）触发。
    }

    public drainDepositEvents(): FxEvent[] {
        return this.depositEvents.splice(0, this.depositEvents.length);
    }

    public drainStrikeEvents(): FxEvent[] {
        return this.strikeEvents.splice(0, this.strikeEvents.length);
    }

    public drainFireEvents(): FireEvent[] {
        return this.fireEvents.splice(0, this.fireEvents.length);
    }

    private openVault(): void {
        this.vaultOpened = true;
        this.phase = CrewPhase.Boom;
        this.boomTimer = CONFIG.boomDuration;
        this.spawnHorde();
    }

    // 敌潮防御演出：打捞完成的瞬间敌潮涌来，防线火力兑现。
    private spawnHorde(): void {
        for (let i = 0; i < CONFIG.defense.enemyCount; i += 1) {
            this.horde.push({
                id: this.nextEnemyId,
                x: 55 + ((i * 53) % 281),
                y: CONFIG.defense.spawnY + (i % 4) * 28,
                alive: true,
            });
            this.nextEnemyId += 1;
        }
    }

    private tickDefense(deltaTime: number): void {
        for (const enemy of this.horde) {
            if (!enemy.alive) {
                continue;
            }
            enemy.y = Math.max(CONFIG.defense.lineY, enemy.y - CONFIG.defense.enemySpeed * deltaTime);
        }

        this.fireTimer -= deltaTime;
        while (this.fireTimer <= 0) {
            // 威胁优先：离防线最近（y 最小）的活敌先被点名。
            let target: HordeEnemy | null = null;
            for (const enemy of this.horde) {
                if (enemy.alive && (!target || enemy.y < target.y)) {
                    target = enemy;
                }
            }
            if (!target) {
                this.fireTimer = 0;
                break;
            }
            const turret = CONFIG.defense.turrets[this.turretIndex % CONFIG.defense.turrets.length];
            this.turretIndex += 1;
            target.alive = false;
            this.ammo = Math.max(0, this.ammo - 1);
            this.fireEvents.push({ fromX: turret.x, fromY: turret.y, toX: target.x, toY: target.y });
            this.fireTimer += CONFIG.defense.fireInterval;
        }
    }

    private gainAmmo(bars: number): void {
        this.ammo = Math.min(CONFIG.defense.ammoCap, this.ammo + bars * CONFIG.defense.ammoPerBar);
    }

    // 主角：先消费玩家的移动指令，再做「范围内自动交互」——
    // 挨着矿脉自动开采、背满且挨着仓库自动投递；其余时间原地待命。
    private tickChief(deltaTime: number): void {
        const chief = this.chief;
        if (chief.moveTargetX !== null && chief.moveTargetY !== null) {
            if (this.moveToward(chief, chief.moveTargetX, chief.moveTargetY, deltaTime)) {
                chief.moveTargetX = null;
                chief.moveTargetY = null;
            }
        }

        if (chief.carrying < CONFIG.workerCapacity) {
            const vein = this.veins.find(item => item.stock > 0
                && this.isZoneUnlocked(item.zoneId)
                && Math.hypot(item.x - chief.x, item.y - chief.y) <= CONFIG.actionRange);
            if (vein) {
                this.setChiefMode('strike');
                chief.actionTimer += deltaTime;
                while (chief.actionTimer >= CONFIG.strikeInterval && vein.stock > 0 && chief.carrying < CONFIG.workerCapacity) {
                    chief.actionTimer -= CONFIG.strikeInterval;
                    vein.stock -= 1;
                    chief.carrying += CONFIG.yieldPerStrike;
                    this.strikeEvents.push({ x: vein.x, y: vein.y, amount: CONFIG.yieldPerStrike });
                    if (vein.stock <= 0) {
                        vein.respawnTimer = CONFIG.veinRespawn;
                    }
                }
                return;
            }
        }

        if (chief.carrying > 0) {
            const depot = CONFIG.stations.depot;
            if (Math.hypot(depot.x - chief.x, depot.y - chief.y) <= CONFIG.actionRange + 24) {
                this.setChiefMode('deposit');
                chief.actionTimer += deltaTime;
                if (chief.actionTimer >= CONFIG.depositTime) {
                    chief.actionTimer = 0;
                    const amount = chief.carrying * CONFIG.goldPerBar;
                    this.gainAmmo(chief.carrying);
                    chief.carrying = 0;
                    this.gold += amount;
                    this.depositEvents.push({ x: chief.x, y: chief.y, amount });
                }
                return;
            }
        }

        this.setChiefMode('idle');
    }

    private setChiefMode(mode: Chief['mode']): void {
        if (this.chief.mode !== mode) {
            this.chief.mode = mode;
            this.chief.actionTimer = 0;
        }
    }

    private tickVeins(deltaTime: number): void {
        for (const vein of this.veins) {
            if (vein.stock <= 0 && vein.respawnTimer > 0) {
                vein.respawnTimer -= deltaTime;
                if (vein.respawnTimer <= 0) {
                    vein.stock = CONFIG.veinStock;
                }
            }
        }
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
            task: 'rally',
            actionTimer: 0,
            targetVeinId: null,
        };
        this.nextWorkerId += 1;
        this.workers.push(worker);
        this.trees.set(worker.id, {
            tree: this.buildWorkerBrain(),
            context: { worker },
        });
    }

    // 感知式大脑：满载回投 → 范围索敌并自动开采 → 有货无目标先回投 → 向矿区集结。
    private buildWorkerBrain(): BtNode<WorkerContext> {
        return new Repeat(new Selector<WorkerContext>([
            new Sequence<WorkerContext>([
                new Condition(context => context.worker.carrying >= CONFIG.workerCapacity),
                new Action((context, dt) => this.goToDepot(context.worker, dt)),
                new Action((context, dt) => this.deposit(context.worker, dt)),
            ]),
            new Sequence<WorkerContext>([
                new Action(context => this.acquireTarget(context.worker)),
                new Action((context, dt) => this.approachTarget(context.worker, dt)),
                new Action((context, dt) => this.strikeTarget(context.worker, dt)),
            ]),
            new Sequence<WorkerContext>([
                new Condition(context => context.worker.carrying > 0),
                new Action((context, dt) => this.goToDepot(context.worker, dt)),
                new Action((context, dt) => this.deposit(context.worker, dt)),
            ]),
            new Action((context, dt) => this.rally(context.worker, dt)),
        ]));
    }

    // 探测半径内锁定最近的有货矿脉；找不到则本分支失败，交给后续分支。
    private acquireTarget(worker: Worker): BtStatus {
        let best: Vein | null = null;
        let bestDistance: number = CONFIG.detectRange;
        for (const vein of this.veins) {
            if (vein.stock <= 0 || !this.isZoneUnlocked(vein.zoneId)) {
                continue;
            }
            const distance = Math.hypot(vein.x - worker.x, vein.y - worker.y);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = vein;
            }
        }
        if (!best) {
            worker.targetVeinId = null;
            return BtStatus.Failure;
        }
        worker.targetVeinId = best.id;
        return BtStatus.Success;
    }

    private approachTarget(worker: Worker, deltaTime: number): BtStatus {
        const vein = this.targetOf(worker);
        if (!vein || vein.stock <= 0) {
            return BtStatus.Failure;
        }
        worker.task = 'approach';
        const distance = Math.hypot(vein.x - worker.x, vein.y - worker.y);
        if (distance <= CONFIG.actionRange) {
            return BtStatus.Success;
        }
        this.moveToward(worker, vein.x, vein.y, deltaTime);
        return BtStatus.Running;
    }

    // 自动开采：按攻击间隔敲击目标，产出上背；背满或矿脉敲空则本轮结束。
    private strikeTarget(worker: Worker, deltaTime: number): BtStatus {
        const vein = this.targetOf(worker);
        if (!vein || vein.stock <= 0) {
            worker.actionTimer = 0;
            return BtStatus.Success;
        }
        worker.task = 'strike';
        worker.actionTimer += deltaTime;
        while (worker.actionTimer >= CONFIG.strikeInterval && vein.stock > 0 && worker.carrying < CONFIG.workerCapacity) {
            worker.actionTimer -= CONFIG.strikeInterval;
            vein.stock -= 1;
            worker.carrying += CONFIG.yieldPerStrike;
            this.strikeEvents.push({ x: vein.x, y: vein.y, amount: CONFIG.yieldPerStrike });
            if (vein.stock <= 0) {
                vein.respawnTimer = CONFIG.veinRespawn;
            }
        }
        if (worker.carrying >= CONFIG.workerCapacity || vein.stock <= 0) {
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
        this.gainAmmo(worker.carrying);
        worker.carrying = 0;
        this.gold += amount;
        this.depositEvents.push({ x: worker.x, y: worker.y, amount });
        worker.task = 'rally';
        return BtStatus.Success;
    }

    // 无目标时向最近的解锁矿区集结，靠近后目标自然进入探测范围。
    private rally(worker: Worker, deltaTime: number): BtStatus {
        worker.task = 'rally';
        const zone = this.nearestUnlockedZone(worker);
        if (!zone) {
            return BtStatus.Success;
        }
        return this.moveToward(worker, zone.x, zone.y + 52, deltaTime)
            ? BtStatus.Success
            : BtStatus.Running;
    }

    private targetOf(worker: Worker): Vein | null {
        return this.veins.find(vein => vein.id === worker.targetVeinId) ?? null;
    }

    private isZoneUnlocked(zoneId: number): boolean {
        return this.zones.find(zone => zone.id === zoneId)?.unlocked ?? false;
    }

    private nearestUnlockedZone(worker: Worker): Zone | null {
        let best: Zone | null = null;
        let bestDistance = Infinity;
        for (const zone of this.zones) {
            if (!zone.unlocked) {
                continue;
            }
            const distance = Math.hypot(zone.x - worker.x, zone.y - worker.y);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = zone;
            }
        }
        return best;
    }

    private moveToward(unit: { x: number; y: number }, targetX: number, targetY: number, deltaTime: number): boolean {
        const dx = targetX - unit.x;
        const dy = targetY - unit.y;
        const distance = Math.hypot(dx, dy);
        const step = CONFIG.workerSpeed * deltaTime;
        if (distance <= step || distance < 1) {
            unit.x = targetX;
            unit.y = targetY;
            return true;
        }
        unit.x += (dx / distance) * step;
        unit.y += (dy / distance) * step;
        return false;
    }
}
