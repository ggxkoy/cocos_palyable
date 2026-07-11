import { Color, Node, Prefab, instantiate } from 'cc';
import { createBox3D, setBoxColor } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { RopeSim, RopeWreck } from './RopeSim';

// 打捞视觉：泥潭中的分级残骸（半沉、随等级增大）、拉拽时的绳索与
// 残骸向拉拽者滑动/上浮、绳级不够的残骸呈暗色（够不着的诱惑=长期锚点）。
const WRECK_TINT: Record<number, Color> = {
    1: new Color(120, 140, 170, 255),
    2: new Color(96, 122, 168, 255),
    3: new Color(80, 105, 160, 255),
};
const WRECK_LOCKED = new Color(70, 74, 84, 255);
const ROPE = new Color(214, 178, 118, 255);

const WRECK_SIZE: Record<number, { w: number; h: number; l: number }> = {
    1: { w: 0.7, h: 0.4, l: 0.55 },
    2: { w: 1.2, h: 0.6, l: 0.9 },
    3: { w: 1.9, h: 0.85, l: 1.3 },
};

interface WreckView {
    readonly node: Node;
    locked: boolean;
}

export class RopeModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private readonly views = new Map<number, WreckView>();
    private ropeNode: Node | null = null;

    constructor(
        private readonly rope: RopeSim,
        private readonly wreckPrefab: Prefab | null = null,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;
        for (const wreck of this.rope.wrecks) {
            const size = WRECK_SIZE[wreck.tier] ?? WRECK_SIZE[1];
            let node: Node;
            if (this.wreckPrefab) {
                node = instantiate(this.wreckPrefab);
                node.name = `Wreck-T${wreck.tier}-${wreck.id}`;
                node.setPosition(wreck.x, 0.05, wreck.z);
                node.setScale(0.7 + wreck.tier * 0.35, 0.7 + wreck.tier * 0.35, 0.7 + wreck.tier * 0.35);
                context.world.addChild(node);
            } else {
                node = createBox3D(`Wreck-T${wreck.tier}-${wreck.id}`, context.world, wreck.x, 0.08, wreck.z, size.w, size.h, size.l, WRECK_TINT[wreck.tier]);
                node.setRotationFromEuler(0, (wreck.id * 53) % 180, -8);
            }
            this.views.set(wreck.id, { node, locked: false });
        }

        const ropeNode = createBox3D('SalvageRope', context.world, 0, 0.35, 0, 0.06, 0.06, 1, ROPE);
        ropeNode.active = false;
        this.ropeNode = ropeNode;
    }

    public tick(deltaTime: number, time: number): void {
        let pulling: RopeWreck | null = null;
        for (const wreck of this.rope.wrecks) {
            const view = this.views.get(wreck.id);
            if (!view) {
                continue;
            }
            if (wreck.state === 'respawning') {
                view.node.active = false;
                continue;
            }
            view.node.active = true;

            // 绳级不够 → 暗色锁定观感（看得见够不着的长期诱惑）。
            const locked = wreck.tier > this.rope.level;
            if (!this.wreckPrefab && locked !== view.locked) {
                view.locked = locked;
                setBoxColor(view.node, locked ? WRECK_LOCKED : WRECK_TINT[wreck.tier]);
            }

            if (wreck.state === 'pulling') {
                pulling = wreck;
                // 向拉拽者滑动 + 上浮：进度越大越接近岸。
                const px = wreck.x + (wreck.pullerX - wreck.x) * wreck.progress * 0.55;
                const pz = wreck.z + (wreck.pullerZ - wreck.z) * wreck.progress * 0.55;
                view.node.setPosition(px, 0.08 + wreck.progress * 0.3, pz);
            } else {
                // 半沉微沉浮。
                const bob = Math.sin(time * 1.6 + wreck.id) * 0.03;
                view.node.setPosition(wreck.x, 0.08 + bob, wreck.z);
            }
        }

        // 绳索：从拉拽者拉到残骸当前位置。
        if (this.ropeNode) {
            if (pulling) {
                const view = this.views.get(pulling.id);
                const wx = view ? pulling.x + (pulling.pullerX - pulling.x) * pulling.progress * 0.55 : pulling.x;
                const wz = view ? pulling.z + (pulling.pullerZ - pulling.z) * pulling.progress * 0.55 : pulling.z;
                const dx = wx - pulling.pullerX;
                const dz = wz - pulling.pullerZ;
                const length = Math.max(0.2, Math.hypot(dx, dz));
                this.ropeNode.active = true;
                this.ropeNode.setPosition((pulling.pullerX + wx) / 2, 0.5, (pulling.pullerZ + wz) / 2);
                this.ropeNode.setScale(1, 1, length);
                this.ropeNode.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
            } else {
                this.ropeNode.active = false;
            }
        }
    }
}
