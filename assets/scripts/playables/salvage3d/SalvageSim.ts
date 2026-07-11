import { EventBus } from '../../framework/EventBus';
import { AvatarSim } from '../../modules/avatar/AvatarSim';
import { DefenseSim } from '../../modules/defense/DefenseSim';
import { EconomySim } from '../../modules/economy/EconomySim';
import { GoalChainSim } from '../../modules/goalchain/GoalChainSim';
import { PickupSim } from '../../modules/pickups/PickupSim';
import { RopeSim } from '../../modules/rope/RopeSim';
import { WorkerCrewSim } from '../../modules/workers/WorkerCrewSim';
import { SALVAGE3D_CONFIG, Salvage3DConfig } from './Salvage3DConfig';

// 纯逻辑拼装：挑模块 → 注入依赖 → 用事件总线接线。
// 视觉层（各 *Module.ts）只读这里的状态、听同一条总线，不参与规则。
export interface SalvageSim {
    readonly bus: EventBus;
    readonly economy: EconomySim;
    readonly rope: RopeSim;
    readonly pickups: PickupSim;
    readonly avatar: AvatarSim;
    readonly workers: WorkerCrewSim;
    readonly goal: GoalChainSim;
    readonly defense: DefenseSim;
    tick(deltaTime: number): void;
}

export function createSalvageSim(config: Salvage3DConfig = SALVAGE3D_CONFIG): SalvageSim {
    const bus = new EventBus();
    const world = config.world;

    const economy = new EconomySim({
        ammoByKind: config.pickups.ammoByKind,
        ammoCap: config.defense.ammoCap,
        coinValue: config.pickups.coinValue,
    });

    const rope = new RopeSim({
        wrecks: config.rope.wrecks,
        tierSpecs: config.rope.tierSpecs,
        ranges: config.rope.ranges,
        respawnTime: config.rope.respawnTime,
    }, bus);

    const pickups = new PickupSim();

    const defense = new DefenseSim({
        turrets: world.turrets,
        enemyCount: config.defense.enemyCount,
        enemySpeed: config.defense.enemySpeed,
        gruntHp: config.defense.gruntHp,
        bossCount: config.defense.bossCount,
        bossHp: config.defense.bossHp,
        bossSpeed: config.defense.bossSpeed,
        fireInterval: config.defense.fireInterval,
        bulletSpeed: config.defense.bulletSpeed,
        deathTime: config.defense.deathTime,
        spawnZ: world.hordeSpawnZ,
        lineZ: world.hordeLineZ,
        fieldHalfWidth: world.ground.width / 2 - 0.8,
        trickleInterval: config.defense.trickleInterval,
        trickleCount: config.defense.trickleCount,
        wall: config.defense.wall,
    }, economy, bus);

    const avatar = new AvatarSim({
        spawn: world.avatarSpawn,
        depot: world.depot,
        speed: config.avatarSpeed,
        capacity: config.capacity,
        depositTime: config.depositTime,
        workSearchRange: config.workSearchRange,
        depositRange: config.depositRange,
        pickupRange: config.pickups.pickupRange,
        meleeRange: config.avatarCombat.meleeRange,
        rangedRange: config.avatarCombat.rangedRange,
        attackInterval: config.avatarCombat.attackInterval,
        attackDamage: config.avatarCombat.attackDamage,
        // 泥潭不可通行：北界钳在岸线，深处只能用绳子够。
        bounds: {
            halfWidth: world.ground.width / 2 - 0.4,
            minZ: world.swamp.shoreZ + 0.1,
            maxZ: world.ground.length / 2 - 0.4,
        },
    }, rope, pickups, defense, economy, bus);

    const workers = new WorkerCrewSim({
        spawn: world.avatarSpawn,
        depot: world.depot,
        rally: world.workerRally,
        speed: config.workerSpeed,
        capacity: config.capacity,
        depositTime: config.depositTime,
        workSearchRange: config.workSearchRange,
        detectRange: config.detectRange,
        pickupRange: config.pickups.pickupRange,
    }, rope, pickups, economy, bus);

    const goal = new GoalChainSim({
        purchases: config.purchases,
        padRadius: config.padRadius,
        vaultRadius: config.vaultRadius,
        dwellTime: config.dwellTime,
    }, economy, bus);
    goal.attachPresence(() => ({ x: avatar.x, z: avatar.z }));
    // 大飞机需要满级绳子才能捞（长度+质量都到位）。
    goal.attachRequirement('vault', () => rope.level >= rope.maxLevel);

    // 模块接线（全部状态/事件驱动，无秒表）：
    // 打捞出的废料散成掉落物；rope 升级；首次换到弹药后丧尸开始来；
    // 敌人倒地掉金币；敌潮清场驱动结算。
    bus.on('rope:salvaged', payload => {
        const salvage = payload as { scrapKind: string; scrapCount: number; x: number; z: number };
        for (let i = 0; i < salvage.scrapCount; i += 1) {
            const angle = (i / salvage.scrapCount) * Math.PI * 2;
            pickups.spawn(salvage.scrapKind, salvage.x + Math.cos(angle) * 0.5, salvage.z + 0.4 + Math.sin(angle) * 0.35);
        }
    });
    bus.on('goal:hire', () => workers.hire());
    bus.on('goal:unlock', () => rope.upgrade());
    let trickleStarted = false;
    bus.on('fx:deposit', () => {
        // 第一次换到弹药，防线有了火力——丧尸压力随之而来。
        if (!trickleStarted && !goal.vaultOpened) {
            trickleStarted = true;
            defense.startTrickle();
        }
    });
    defense.attachProgress(() => goal.purchases.filter(p => p.purchased).length);
    bus.on('enemy:down', payload => {
        const down = payload as { x: number; z: number };
        pickups.spawn('gold', down.x, down.z);
    });
    bus.on('defense:cleared', () => goal.finish());
    // 围墙被击破=失败结算；复活（EndCard 重试按钮）时修墙并击退现存敌人。
    bus.on('wall:breached', () => goal.fail());
    bus.on('goal:revive', () => defense.reviveWall());

    return {
        bus,
        economy,
        rope,
        pickups,
        avatar,
        workers,
        goal,
        defense,
        tick(deltaTime: number): void {
            avatar.tick(deltaTime);
            workers.tick(deltaTime);
            rope.tick(deltaTime);
            goal.tick(deltaTime);
            defense.tick(deltaTime);
        },
    };
}
