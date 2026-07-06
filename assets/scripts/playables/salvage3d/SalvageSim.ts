import { EventBus } from '../../framework/EventBus';
import { AvatarSim } from '../../modules/avatar/AvatarSim';
import { DefenseSim } from '../../modules/defense/DefenseSim';
import { EconomySim } from '../../modules/economy/EconomySim';
import { GoalChainSim } from '../../modules/goalchain/GoalChainSim';
import { HarvestSim } from '../../modules/harvest/HarvestSim';
import { PickupSim } from '../../modules/pickups/PickupSim';
import { WorkerCrewSim } from '../../modules/workers/WorkerCrewSim';
import { SALVAGE3D_CONFIG, Salvage3DConfig } from './Salvage3DConfig';

// 纯逻辑拼装：挑模块 → 注入依赖 → 用事件总线接线。
// 视觉层（各 *Module.ts）只读这里的状态、听同一条总线，不参与规则。
export interface SalvageSim {
    readonly bus: EventBus;
    readonly economy: EconomySim;
    readonly harvest: HarvestSim;
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
        valueByKind: config.pickups.valueByKind,
        ammoPerItem: config.defense.ammoPerItem,
        ammoCap: config.defense.ammoCap,
    });

    const harvest = new HarvestSim({
        zones: world.zones,
        veinOffsets: world.veinOffsets,
        veinStock: config.veinStock,
        veinRespawn: config.veinRespawn,
    });

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
    }, economy, bus);

    const avatar = new AvatarSim({
        spawn: world.avatarSpawn,
        depot: world.depot,
        speed: config.avatarSpeed,
        capacity: config.capacity,
        strikeInterval: config.strikeInterval,
        depositTime: config.depositTime,
        actionRange: config.actionRange,
        depositRange: config.depositRange,
        pickupRange: config.pickups.pickupRange,
        meleeRange: config.avatarCombat.meleeRange,
        rangedRange: config.avatarCombat.rangedRange,
        attackInterval: config.avatarCombat.attackInterval,
        attackDamage: config.avatarCombat.attackDamage,
        bounds: { halfWidth: world.ground.width / 2 - 0.4, halfLength: world.ground.length / 2 - 0.4 },
    }, harvest, pickups, defense, economy, bus);

    const workers = new WorkerCrewSim({
        spawn: world.avatarSpawn,
        depot: world.depot,
        speed: config.workerSpeed,
        capacity: config.capacity,
        strikeInterval: config.strikeInterval,
        depositTime: config.depositTime,
        actionRange: config.actionRange,
        detectRange: config.detectRange,
        pickupRange: config.pickups.pickupRange,
    }, harvest, pickups, economy, bus);

    const goal = new GoalChainSim({
        purchases: config.purchases,
        padRadius: config.padRadius,
        vaultRadius: config.vaultRadius,
        dwellTime: config.dwellTime,
    }, economy, bus);
    // 踩牌购买：目标链盯着主角的位置。
    goal.attachPresence(() => ({ x: avatar.x, z: avatar.z }));

    // 模块接线：目标链购买驱动世界变化；敌人倒地掉金币；
    // 终局演出没有时长——敌潮清场事件驱动结算（非线性原则）。
    let trickleStarted = false;
    bus.on('goal:purchased', () => {
        // 首次购买开启渗透波；若首购就是打捞大飞机（极端非线性路线），直接进终局不开波。
        if (!trickleStarted && !goal.vaultOpened) {
            trickleStarted = true;
            defense.startTrickle();
        }
    });
    defense.attachProgress(() => goal.purchases.filter(p => p.purchased).length);
    bus.on('goal:hire', () => workers.hire());
    bus.on('goal:unlock', () => harvest.unlockNextZone());
    bus.on('defense:cleared', () => goal.finish());
    bus.on('enemy:down', payload => {
        const down = payload as { x: number; z: number };
        pickups.spawn('gold', down.x, down.z);
    });

    return {
        bus,
        economy,
        harvest,
        pickups,
        avatar,
        workers,
        goal,
        defense,
        tick(deltaTime: number): void {
            harvest.tick(deltaTime);
            avatar.tick(deltaTime);
            workers.tick(deltaTime);
            goal.tick(deltaTime);
            defense.tick(deltaTime);
        },
    };
}
