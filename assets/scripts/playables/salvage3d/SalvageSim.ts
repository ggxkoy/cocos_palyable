import { EventBus } from '../../framework/EventBus';
import { AvatarSim } from '../../modules/avatar/AvatarSim';
import { DefenseSim } from '../../modules/defense/DefenseSim';
import { EconomySim } from '../../modules/economy/EconomySim';
import { GoalChainSim } from '../../modules/goalchain/GoalChainSim';
import { HarvestSim } from '../../modules/harvest/HarvestSim';
import { WorkerCrewSim } from '../../modules/workers/WorkerCrewSim';
import { SALVAGE3D_CONFIG, Salvage3DConfig } from './Salvage3DConfig';

// 纯逻辑拼装：挑模块 → 注入依赖 → 用事件总线接线。
// 视觉层（各 *Module.ts）只读这里的状态、听同一条总线，不参与规则。
export interface SalvageSim {
    readonly bus: EventBus;
    readonly economy: EconomySim;
    readonly harvest: HarvestSim;
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
        goldPerBar: config.goldPerBar,
        ammoPerBar: config.defense.ammoPerBar,
        ammoCap: config.defense.ammoCap,
    });

    const harvest = new HarvestSim({
        zones: world.zones,
        veinOffsets: world.veinOffsets,
        veinStock: config.veinStock,
        veinRespawn: config.veinRespawn,
    });

    const avatar = new AvatarSim({
        spawn: world.avatarSpawn,
        depot: world.depot,
        speed: config.avatarSpeed,
        capacity: config.capacity,
        strikeInterval: config.strikeInterval,
        yieldPerStrike: config.yieldPerStrike,
        depositTime: config.depositTime,
        actionRange: config.actionRange,
        depositRange: config.depositRange,
        bounds: { halfWidth: world.ground.width / 2 - 0.4, halfLength: world.ground.length / 2 - 0.4 },
    }, harvest, economy, bus);

    const workers = new WorkerCrewSim({
        spawn: world.avatarSpawn,
        depot: world.depot,
        speed: config.workerSpeed,
        capacity: config.capacity,
        strikeInterval: config.strikeInterval,
        yieldPerStrike: config.yieldPerStrike,
        depositTime: config.depositTime,
        actionRange: config.actionRange,
        detectRange: config.detectRange,
    }, harvest, economy, bus);

    const goal = new GoalChainSim({
        purchases: config.purchases,
        padRadius: config.padRadius,
        vaultRadius: config.vaultRadius,
        boomDuration: config.boomDuration,
    }, economy, bus);

    const defense = new DefenseSim({
        turrets: world.turrets,
        enemyCount: config.defense.enemyCount,
        enemySpeed: config.defense.enemySpeed,
        fireInterval: config.defense.fireInterval,
        spawnZ: world.hordeSpawnZ,
        lineZ: world.hordeLineZ,
        fieldHalfWidth: world.ground.width / 2 - 0.8,
    }, economy, bus);

    // 模块接线：目标链的购买事件驱动其他模块的世界变化。
    bus.on('goal:hire', () => workers.hire());
    bus.on('goal:unlock', () => harvest.unlockNextZone());

    return {
        bus,
        economy,
        harvest,
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
