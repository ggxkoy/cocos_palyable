import { Color, EventTouch, Node, UITransform } from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../common/Layout';
import { createNode } from '../../common/PlaceholderFactory';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { GoalChainSim } from '../goalchain/GoalChainSim';
import { AvatarSim } from './AvatarSim';

// 主角视觉 + 输入。点击地面 = 移动指令（操作归属给玩家）；
// 点击命中当前目标牌/大锚点则优先按购买处理。
const BODY = new Color(61, 109, 176, 255);
const HEAD = new Color(240, 205, 165, 255);
const CARRY = new Color(255, 200, 80, 255);
const MARKER = new Color(255, 245, 196, 255);

export class AvatarModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private root: Node | null = null;
    private marker: Node | null = null;
    private carryStack: Node[] = [];
    private inputLayer: Node | null = null;
    private readonly onTouch = (event: EventTouch): void => this.handleTouch(event);

    constructor(
        private readonly avatar: AvatarSim,
        private readonly goal: GoalChainSim,
        private readonly capacity: number,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;

        const root = new Node('Avatar');
        context.world.addChild(root);
        createBox3D('Body', root, 0, 0.45, 0, 0.5, 0.9, 0.42, BODY);
        createBox3D('Head', root, 0, 1.12, 0, 0.34, 0.34, 0.34, HEAD);
        this.carryStack = [];
        for (let i = 0; i < this.capacity; i += 1) {
            const bar = createBox3D(`Carry${i}`, root, 0, 1.45 + i * 0.2, 0, 0.42, 0.14, 0.3, CARRY);
            bar.active = false;
            this.carryStack.push(bar);
        }
        this.root = root;

        const marker = createBox3D('MoveMarker', context.world, 0, 0.05, 0, 0.4, 0.05, 0.4, MARKER);
        marker.setRotationFromEuler(0, 45, 0);
        marker.active = false;
        this.marker = marker;

        const input = createNode('GroundInput', context.ui, 0, 0);
        input.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        input.on(Node.EventType.TOUCH_END, this.onTouch, this);
        this.inputLayer = input;
    }

    public tick(): void {
        if (this.root) {
            this.root.setPosition(this.avatar.x, 0, this.avatar.z);
        }
        this.carryStack.forEach((bar, index) => {
            bar.active = this.avatar.carrying > index;
        });
        if (this.marker) {
            const hasTarget = this.avatar.moveTargetX !== null && this.avatar.moveTargetZ !== null;
            this.marker.active = hasTarget;
            if (hasTarget) {
                this.marker.setPosition(this.avatar.moveTargetX!, 0.05, this.avatar.moveTargetZ!);
            }
        }
    }

    public dispose(): void {
        this.inputLayer?.off(Node.EventType.TOUCH_END, this.onTouch, this);
    }

    private handleTouch(event: EventTouch): void {
        const camera = this.context?.camera3d;
        if (!camera) {
            return;
        }
        const screen = event.getLocation();
        const ray = camera.screenPointToRay(screen.x, screen.y);
        if (Math.abs(ray.d.y) < 1e-5) {
            return;
        }
        // 与地面 y=0 求交，得到世界坐标点击点。
        const t = -ray.o.y / ray.d.y;
        if (t <= 0) {
            return;
        }
        const x = ray.o.x + ray.d.x * t;
        const z = ray.o.z + ray.d.z * t;
        if (this.goal.tapAt(x, z)) {
            return;
        }
        this.avatar.commandMove(x, z);
    }
}
