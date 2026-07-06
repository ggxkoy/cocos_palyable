import { Color, EventTouch, Node, Prefab, UITransform, instantiate, v3 } from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../common/Layout';
import { createBox, createNode } from '../../common/PlaceholderFactory';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { AvatarSim } from './AvatarSim';

// 主角视觉 + 虚拟摇杆输入（手机标准操控）：
// 按下任意位置出现摇杆，拖动方向驱动移动，松手立刻停——操作归属完全在玩家。
// 美术：playerPrefab 槽位（01_主角 FBX），空则用占位盒子。
const BODY = new Color(61, 109, 176, 255);
const HEAD = new Color(240, 205, 165, 255);
const CARRY = new Color(255, 200, 80, 255);
const JOY_BASE = new Color(255, 255, 255, 56);
const JOY_KNOB = new Color(255, 216, 95, 220);
const JOY_RADIUS = 110;

export class AvatarModule implements PlayableModule {
    private uiTransform: UITransform | null = null;
    private root: Node | null = null;
    private model: Node | null = null;
    private carryStack: Node[] = [];
    private inputLayer: Node | null = null;
    private joyBase: Node | null = null;
    private joyKnob: Node | null = null;
    private dragging = false;
    private originX = 0;
    private originY = 0;

    private readonly onTouchStart = (event: EventTouch): void => this.handleStart(event);
    private readonly onTouchMove = (event: EventTouch): void => this.handleMove(event);
    private readonly onTouchEnd = (): void => this.handleEnd();

    constructor(
        private readonly avatar: AvatarSim,
        private readonly capacity: number,
        private readonly avatarPrefab: Prefab | null,
    ) {}

    public start(context: ModuleContext): void {
        this.uiTransform = context.ui.getComponent(UITransform);

        const root = new Node('Avatar');
        context.world.addChild(root);
        if (this.avatarPrefab) {
            const model = instantiate(this.avatarPrefab);
            model.name = 'AvatarModel';
            model.setRotationFromEuler(0, 180, 0);
            root.addChild(model);
            this.model = model;
        } else {
            createBox3D('Body', root, 0, 0.45, 0, 0.5, 0.9, 0.42, BODY);
            createBox3D('Head', root, 0, 1.12, 0, 0.34, 0.34, 0.34, HEAD);
        }
        this.carryStack = [];
        for (let i = 0; i < this.capacity; i += 1) {
            const bar = createBox3D(`Carry${i}`, root, 0, 1.45 + i * 0.2, 0, 0.42, 0.14, 0.3, CARRY);
            bar.active = false;
            this.carryStack.push(bar);
        }
        this.root = root;

        const input = createNode('JoystickInput', context.ui, 0, 0);
        input.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        input.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.inputLayer = input;

        const base = createBox('JoystickBase', context.ui, 0, 0, JOY_RADIUS * 2, JOY_RADIUS * 2, JOY_BASE);
        base.angle = 45;
        base.active = false;
        this.joyBase = base;
        const knob = createBox('JoystickKnob', context.ui, 0, 0, 66, 66, JOY_KNOB);
        knob.angle = 45;
        knob.active = false;
        this.joyKnob = knob;
    }

    public tick(): void {
        if (this.root) {
            this.root.setPosition(this.avatar.x, 0, this.avatar.z);
        }
        // 模型面向移动方向（占位盒子无方向感，仅对真实模型生效）。
        if (this.model && this.avatar.moving) {
            const yaw = Math.atan2(this.avatar.inputX, this.avatar.inputZ) * 180 / Math.PI;
            this.model.setRotationFromEuler(0, yaw + 180, 0);
        }
        this.carryStack.forEach((bar, index) => {
            bar.active = this.avatar.carrying > index;
        });
    }

    public dispose(): void {
        if (this.inputLayer) {
            this.inputLayer.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.inputLayer.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.inputLayer.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.inputLayer.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
    }

    private toLocal(event: EventTouch): { x: number; y: number } {
        const ui = event.getUILocation();
        if (!this.uiTransform) {
            return { x: ui.x - DESIGN_WIDTH * 0.5, y: ui.y - DESIGN_HEIGHT * 0.5 };
        }
        const local = this.uiTransform.convertToNodeSpaceAR(v3(ui.x, ui.y, 0));
        return { x: local.x, y: local.y };
    }

    private handleStart(event: EventTouch): void {
        const local = this.toLocal(event);
        this.dragging = true;
        this.originX = local.x;
        this.originY = local.y;
        this.joyBase?.setPosition(local.x, local.y, 0);
        this.joyKnob?.setPosition(local.x, local.y, 0);
        if (this.joyBase) this.joyBase.active = true;
        if (this.joyKnob) this.joyKnob.active = true;
    }

    private handleMove(event: EventTouch): void {
        if (!this.dragging) {
            return;
        }
        const local = this.toLocal(event);
        const dx = local.x - this.originX;
        const dy = local.y - this.originY;
        const length = Math.hypot(dx, dy);
        const clamped = Math.min(length, JOY_RADIUS);
        const nx = length > 0 ? (dx / length) * clamped : 0;
        const ny = length > 0 ? (dy / length) * clamped : 0;
        this.joyKnob?.setPosition(this.originX + nx, this.originY + ny, 0);
        // UI 的 +y（屏幕上方）对应世界 -z（远处）。
        this.avatar.setMoveInput(nx / JOY_RADIUS, -ny / JOY_RADIUS);
    }

    private handleEnd(): void {
        this.dragging = false;
        if (this.joyBase) this.joyBase.active = false;
        if (this.joyKnob) this.joyKnob.active = false;
        this.avatar.setMoveInput(0, 0);
    }
}
