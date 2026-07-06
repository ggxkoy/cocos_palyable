import { Color, Node } from 'cc';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { Pickup, PickupSim } from './PickupSim';

// 掉落物视觉：类型决定形态——金子=金色小方块（旋转 45°），
// 木材=棕色横木条；其他类型回落为灰色小方块。换美术时按 kind 扩展此表。
interface PickupStyle {
    readonly color: Color;
    readonly size: { readonly w: number; readonly h: number; readonly l: number };
    readonly spin: boolean;
}

const STYLES: Record<string, PickupStyle> = {
    gold: { color: new Color(247, 183, 49, 255), size: { w: 0.3, h: 0.24, l: 0.3 }, spin: true },
    wood: { color: new Color(140, 96, 54, 255), size: { w: 0.55, h: 0.2, l: 0.2 }, spin: false },
};
const FALLBACK: PickupStyle = { color: new Color(170, 170, 170, 255), size: { w: 0.28, h: 0.28, l: 0.28 }, spin: false };

export class PickupModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private readonly nodes = new Map<number, Node>();

    constructor(private readonly pickups: PickupSim) {}

    public start(context: ModuleContext): void {
        this.context = context;
    }

    public tick(deltaTime: number, time: number): void {
        if (!this.context) {
            return;
        }
        for (const pickup of this.pickups.pickups) {
            let node = this.nodes.get(pickup.id);
            if (!node && pickup.alive) {
                node = this.createNode(pickup);
                this.nodes.set(pickup.id, node);
            }
            if (!node) {
                continue;
            }
            if (!pickup.alive) {
                if (node.active) {
                    node.destroy();
                    this.nodes.delete(pickup.id);
                }
                continue;
            }
            const style = STYLES[pickup.kind] ?? FALLBACK;
            if (style.spin) {
                node.setRotationFromEuler(0, (time * 120) % 360, 0);
            }
        }
    }

    private createNode(pickup: Pickup): Node {
        const style = STYLES[pickup.kind] ?? FALLBACK;
        const node = createBox3D(`Pickup-${pickup.kind}-${pickup.id}`, this.context!.world, pickup.x, 0.18, pickup.z, style.size.w, style.size.h, style.size.l, style.color);
        if (!style.spin) {
            node.setRotationFromEuler(0, ((pickup.id * 47) % 180), 0);
        }
        return node;
    }
}
