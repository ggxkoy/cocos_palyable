import { Color, Node } from 'cc';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { createBox3D } from '../../common3d/Placeholder3D';
import { HarvestSim } from './HarvestSim';

// 采集视觉：残骸盒子随库存缩放，敲空隐藏、重生恢复；命中时轻微抖动由缩放表达。
const WRECK = new Color(90, 120, 170, 255);

export class HarvestModule implements PlayableModule {
    private readonly veinNodes = new Map<number, Node>();

    constructor(
        private readonly harvest: HarvestSim,
        private readonly veinStock: number,
    ) {}

    public start(context: ModuleContext): void {
        for (const vein of this.harvest.veins) {
            const node = createBox3D(`Vein${vein.id}`, context.world, vein.x, 0.32, vein.z, 0.72, 0.5, 0.6, WRECK);
            this.veinNodes.set(vein.id, node);
        }
    }

    public tick(): void {
        for (const vein of this.harvest.veins) {
            const node = this.veinNodes.get(vein.id);
            if (!node) {
                continue;
            }
            const visible = vein.stock > 0 && this.harvest.isUnlocked(vein.zoneId);
            node.active = visible;
            if (visible) {
                const scale = 0.55 + 0.45 * (vein.stock / this.veinStock);
                node.setScale(scale, scale, scale);
            }
        }
    }
}
