import { Color, Node } from 'cc';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { createBox3D, setBoxColor } from '../../common3d/Placeholder3D';
import { HarvestSim } from '../harvest/HarvestSim';

// 场地模块：地面、泥潭带、防线带、矿区地块（含锁定态）与回收站。
export interface StageConfig {
    readonly ground: { readonly width: number; readonly length: number };
    readonly depot: { readonly x: number; readonly z: number };
    readonly hordeLineZ: number;
}

const SAND = new Color(198, 166, 118, 255);
const SWAMP = new Color(96, 84, 62, 255);
const LINE = new Color(120, 96, 70, 255);
const ZONE_OPEN = new Color(160, 128, 88, 255);
const ZONE_LOCKED = new Color(110, 96, 80, 255);
const LOCK = new Color(52, 46, 40, 255);
const DEPOT = new Color(70, 96, 150, 255);
const DEPOT_TOP = new Color(255, 200, 80, 255);

interface ZoneView {
    readonly zoneId: number;
    readonly plate: Node;
    readonly lock: Node;
    unlocked: boolean;
}

export class StageModule implements PlayableModule {
    private readonly zoneViews: ZoneView[] = [];

    constructor(
        private readonly config: StageConfig,
        private readonly harvest: HarvestSim,
    ) {}

    public start(context: ModuleContext): void {
        const world = context.world;
        const ground = this.config.ground;

        createBox3D('Ground', world, 0, -0.12, 0, ground.width, 0.24, ground.length, SAND);
        createBox3D('Swamp', world, 0, -0.02, -7.6, ground.width, 0.08, 5.4, SWAMP);
        createBox3D('DefenseLine', world, 0, 0.01, this.config.hordeLineZ, ground.width, 0.06, 0.5, LINE);

        for (const zone of this.harvest.zones) {
            const plate = createBox3D(`Zone${zone.id}`, world, zone.x, 0.02, zone.z, 3.1, 0.08, 3.1, zone.unlocked ? ZONE_OPEN : ZONE_LOCKED);
            const lock = createBox3D(`Zone${zone.id}Lock`, world, zone.x, 0.55, zone.z, 0.5, 0.7, 0.5, LOCK);
            lock.active = !zone.unlocked;
            this.zoneViews.push({ zoneId: zone.id, plate, lock, unlocked: zone.unlocked });
        }

        const depot = this.config.depot;
        const depotNode = createBox3D('Depot', world, depot.x, 0.45, depot.z, 2.2, 0.9, 1.4, DEPOT);
        createBox3D('DepotStack', depotNode, 0, 0.62, 0, 1.6, 0.35, 0.9, DEPOT_TOP);
    }

    public tick(): void {
        for (const view of this.zoneViews) {
            const unlocked = this.harvest.isUnlocked(view.zoneId);
            if (unlocked !== view.unlocked) {
                view.unlocked = unlocked;
                view.lock.active = !unlocked;
                setBoxColor(view.plate, unlocked ? ZONE_OPEN : ZONE_LOCKED);
            }
        }
    }
}
