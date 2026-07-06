import { Color, EventTouch, Node, Prefab, SkeletalAnimation, UITransform, instantiate, v3 } from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../common/Layout';
import { createBox, createNode } from '../../common/PlaceholderFactory';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { AvatarSim } from './AvatarSim';

// 主角视觉 + 虚拟摇杆输入 + 动画状态机。
// 摇杆：按下出现、拖动移动、松手即停（操作归属在玩家）。
// 动画：Sim 的感知状态（走/待机/采集/敲击/近战/远程/结算）映射到
// FBX 剪辑名（config.animClips），用 SkeletalAnimation.crossFade 切换。
// 背包：类型化道具按 kind 颜色堆在身后（金子金色、木材棕色）。
interface AvatarFxSegment {
    readonly node: Node;
    life: number;
}

const BODY = new Color(61, 109, 176, 255);
const HEAD = new Color(240, 205, 165, 255);
const KIND_COLORS: Record<string, Color> = {
    gold: new Color(247, 183, 49, 255),
    wood: new Color(140, 96, 54, 255),
};
const KIND_FALLBACK = new Color(170, 170, 170, 255);
const SHOT = new Color(255, 236, 120, 255);
const MELEE = new Color(255, 120, 80, 255);
const JOY_BASE = new Color(255, 255, 255, 56);
const JOY_KNOB = new Color(255, 216, 95, 220);
const JOY_RADIUS = 110;

export class AvatarModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private uiTransform: UITransform | null = null;
    private root: Node | null = null;
    private model: Node | null = null;
    private anim: SkeletalAnimation | null = null;
    private currentClip = '';
    private carryRoot: Node | null = null;
    private lastCarryKey = '';
    private inputLayer: Node | null = null;
    private joyBase: Node | null = null;
    private joyKnob: Node | null = null;
    private dragging = false;
    private originX = 0;
    private originY = 0;
    private readonly fx: AvatarFxSegment[] = [];

    private readonly onTouchStart = (event: EventTouch): void => this.handleStart(event);
    private readonly onTouchMove = (event: EventTouch): void => this.handleMove(event);
    private readonly onTouchEnd = (): void => this.handleEnd();

    constructor(
        private readonly avatar: AvatarSim,
        private readonly avatarPrefab: Prefab | null,
        private readonly animClips: Readonly<Record<string, string>>,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;
        this.uiTransform = context.ui.getComponent(UITransform);

        const root = new Node('Avatar');
        context.world.addChild(root);
        if (this.avatarPrefab) {
            const model = instantiate(this.avatarPrefab);
            model.name = 'AvatarModel';
            model.setRotationFromEuler(0, 180, 0);
            root.addChild(model);
            this.model = model;
            this.anim = model.getComponentInChildren(SkeletalAnimation);
        } else {
            createBox3D('Body', root, 0, 0.45, 0, 0.5, 0.9, 0.42, BODY);
            createBox3D('Head', root, 0, 1.12, 0, 0.34, 0.34, 0.34, HEAD);
        }
        this.carryRoot = new Node('CarryStack');
        root.addChild(this.carryRoot);
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

        context.bus.on('fx:shot', payload => this.spawnBeam(payload as { fromX: number; fromZ: number; toX: number; toZ: number }, SHOT, 0.9));
        context.bus.on('fx:melee', payload => this.spawnBeam(payload as { fromX: number; fromZ: number; toX: number; toZ: number }, MELEE, 0.55));
    }

    public tick(deltaTime: number): void {
        if (this.root) {
            this.root.setPosition(this.avatar.x, 0, this.avatar.z);
        }
        if (this.model && this.avatar.moving) {
            const yaw = Math.atan2(this.avatar.inputX, this.avatar.inputZ) * 180 / Math.PI;
            this.model.setRotationFromEuler(0, yaw + 180, 0);
        }
        this.syncCarryStack();
        this.syncAnimation();

        for (let i = this.fx.length - 1; i >= 0; i -= 1) {
            const segment = this.fx[i];
            segment.life -= deltaTime;
            if (segment.life <= 0) {
                segment.node.destroy();
                this.fx.splice(i, 1);
            }
        }
    }

    public dispose(): void {
        if (this.inputLayer) {
            this.inputLayer.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.inputLayer.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.inputLayer.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.inputLayer.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
    }

    // 背包变化时重建身后的堆叠（每件道具一块，按类型着色）。
    private syncCarryStack(): void {
        if (!this.carryRoot) {
            return;
        }
        const key = this.avatar.carried.join(',');
        if (key === this.lastCarryKey) {
            return;
        }
        this.lastCarryKey = key;
        for (const child of [...this.carryRoot.children]) {
            child.destroy();
        }
        this.avatar.carried.forEach((kind, index) => {
            const color = KIND_COLORS[kind] ?? KIND_FALLBACK;
            createBox3D(`Carry${index}`, this.carryRoot!, 0, 1.45 + index * 0.2, -0.28, 0.42, 0.16, 0.3, color);
        });
    }

    // 状态 → 剪辑名 → crossFade；占位盒子没有动画组件时自动跳过。
    private syncAnimation(): void {
        if (!this.anim) {
            return;
        }
        const state = this.avatar.moving ? 'walk' : this.avatar.mode;
        const clip = this.animClips[state] ?? this.animClips.idle;
        if (!clip || clip === this.currentClip) {
            return;
        }
        if (!this.anim.getState(clip)) {
            return;
        }
        this.anim.crossFade(clip, 0.15);
        this.currentClip = clip;
    }

    private spawnBeam(fire: { fromX: number; fromZ: number; toX: number; toZ: number }, color: Color, height: number): void {
        if (!this.context) {
            return;
        }
        const dx = fire.toX - fire.fromX;
        const dz = fire.toZ - fire.fromZ;
        const length = Math.max(0.3, Math.hypot(dx, dz));
        const beam = createBox3D('AvatarFx', this.context.world, (fire.fromX + fire.toX) / 2, height, (fire.fromZ + fire.toZ) / 2, 0.07, 0.07, length, color);
        beam.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
        this.fx.push({ node: beam, life: 0.09 });
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
