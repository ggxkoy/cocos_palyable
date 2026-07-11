import { Color, Material, MeshRenderer, Node, Prefab, instantiate } from 'cc';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { createBox3D } from '../../common3d/Placeholder3D';

// 场地模块：三屏大地面、泥潭带（不可通行，靠绳子够）、防线带、回收站。
export interface StageConfig {
    readonly ground: { readonly width: number; readonly length: number };
    readonly swamp: { readonly shoreZ: number; readonly centerZ: number; readonly length: number };
    readonly depot: { readonly x: number; readonly z: number };
    readonly hordeLineZ: number;
}

const SAND = new Color(198, 166, 118, 255);
const SWAMP = new Color(96, 84, 62, 255);
const SHORE = new Color(150, 128, 92, 255);
const LINE = new Color(120, 96, 70, 255);
const DEPOT = new Color(70, 96, 150, 255);
const DEPOT_TOP = new Color(255, 200, 80, 255);

export class StageModule implements PlayableModule {
    constructor(
        private readonly config: StageConfig,
        private readonly depotPrefab: Prefab | null = null,
        private readonly groundMaterial: Material | null = null,
    ) {}

    public start(context: ModuleContext): void {
        const world = context.world;
        const ground = this.config.ground;

        const groundNode = createBox3D('Ground', world, 0, -0.12, 0, ground.width, 0.24, ground.length, SAND);
        // 地面材质槽位（07_沙漠泥潭材质做成 Material 后拖入）。
        if (this.groundMaterial) {
            const renderer = groundNode.getComponent(MeshRenderer);
            if (renderer) {
                renderer.material = this.groundMaterial;
            }
        }

        // 泥潭带（北屏打捞区）与岸线；防线带在南屏。
        const swamp = this.config.swamp;
        createBox3D('Swamp', world, 0, -0.02, swamp.centerZ, ground.width, 0.08, swamp.length, SWAMP);
        createBox3D('Shoreline', world, 0, 0.01, swamp.shoreZ, ground.width, 0.05, 0.35, SHORE);
        createBox3D('DefenseLine', world, 0, 0.01, this.config.hordeLineZ, ground.width, 0.06, 0.5, LINE);

        const depot = this.config.depot;
        if (this.depotPrefab) {
            const depotNode = instantiate(this.depotPrefab);
            depotNode.name = 'Depot';
            depotNode.setPosition(depot.x, 0, depot.z);
            world.addChild(depotNode);
        } else {
            const depotNode = createBox3D('Depot', world, depot.x, 0.45, depot.z, 2.2, 0.9, 1.4, DEPOT);
            createBox3D('DepotStack', depotNode, 0, 0.62, 0, 1.6, 0.35, 0.9, DEPOT_TOP);
        }
    }
}
