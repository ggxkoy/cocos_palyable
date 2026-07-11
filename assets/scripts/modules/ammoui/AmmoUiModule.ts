import { Color, Label, Node, UIOpacity, UITransform, Vec3, v3 } from 'cc';
import { createBox, createLabel, createNode } from '../../common/PlaceholderFactory';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { EconomySim } from '../economy/EconomySim';

// 弹药可视化层（2D 叠加，跟随 3D 投影）：
// - 每座机枪塔头顶一块弹药牌：当前弹药数 + 比例条；开火脉冲放大，
//   打空变红闪 "NO AMMO"——弹药状态一眼可见。
// - 兑换飘字：回收站换到弹药时 "+N AMMO" 从回收站上方升起淡出，
//   捡金币时 "+N" 金字飘起——废料→子弹的转化看得见。
const BADGE_BG = new Color(10, 20, 24, 215);
const BADGE_LINE = new Color(73, 214, 183, 255);
const AMMO_TEXT = new Color(158, 255, 228, 255);
const EMPTY_TEXT = new Color(255, 96, 70, 255);
const FLOAT_AMMO = new Color(94, 234, 190, 255);
const FLOAT_GOLD = new Color(255, 214, 92, 255);

const FLOAT_LIFE = 1.15;
const FLOAT_RISE = 92;
const PULSE_TIME = 0.16;

interface TurretBadge {
    readonly worldPos: Vec3;
    readonly root: Node;
    readonly label: Label;
    readonly fill: Node;
    pulse: number;
    lastText: string;
    empty: boolean;
}

interface FloatText {
    readonly node: Node;
    readonly opacity: UIOpacity;
    life: number;
}

export class AmmoUiModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private layer: Node | null = null;
    private readonly badges: TurretBadge[] = [];
    private readonly floats: FloatText[] = [];
    private readonly projected = v3();

    constructor(
        private readonly economy: EconomySim,
        private readonly turrets: ReadonlyArray<{ readonly x: number; readonly z: number }>,
        private readonly ammoCap: number,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;
        const layer = createNode('AmmoUi', context.ui, 0, 0);
        this.layer = layer;

        for (const [index, turret] of this.turrets.entries()) {
            const root = createNode(`TurretAmmo${index}`, layer, 0, 0);
            root.addComponent(UITransform).setContentSize(120, 52);
            createBox('Bg', root, 0, 0, 116, 48, BADGE_BG);
            createBox('Line', root, 0, -21, 116, 4, BADGE_LINE);
            const fill = createBox('Fill', root, 0, -21, 116, 4, BADGE_LINE);
            const label = createLabel('Count', root, 0, 2, '0', 30, AMMO_TEXT);
            this.badges.push({
                worldPos: v3(turret.x, 2.1, turret.z),
                root,
                label,
                fill,
                pulse: 0,
                lastText: '',
                empty: false,
            });
        }

        context.bus.on('fx:fire', () => {
            for (const badge of this.badges) {
                badge.pulse = PULSE_TIME;
            }
        });
        context.bus.on('fx:deposit', payload => {
            const deposit = payload as { x: number; z: number; amount: number };
            this.spawnFloat(`+${deposit.amount} AMMO`, FLOAT_AMMO, deposit.x, deposit.z);
        });
        context.bus.on('fx:coin', payload => {
            const coin = payload as { x: number; z: number; value: number };
            this.spawnFloat(`+${coin.value}`, FLOAT_GOLD, coin.x, coin.z);
        });
    }

    public tick(deltaTime: number, time: number): void {
        const camera = this.context?.camera3d ?? null;
        const ui = this.context?.ui ?? null;
        if (camera && ui) {
            for (const badge of this.badges) {
                camera.convertToUINode(badge.worldPos, ui, this.projected);
                const pulse = badge.pulse > 0 ? 1 + badge.pulse / PULSE_TIME * 0.18 : 1;
                if (badge.pulse > 0) {
                    badge.pulse -= deltaTime;
                }
                badge.root.setPosition(this.projected.x, this.projected.y, 0);
                badge.root.setScale(pulse, pulse, 1);

                const empty = !this.economy.hasAmmo();
                const text = empty ? 'NO AMMO' : String(this.economy.ammo);
                if (text !== badge.lastText || empty !== badge.empty) {
                    badge.lastText = text;
                    badge.empty = empty;
                    badge.label.string = text;
                    badge.label.fontSize = empty ? 20 : 30;
                    badge.label.color = empty ? EMPTY_TEXT : AMMO_TEXT;
                }
                // 打空红字闪烁提醒「去捞废料换子弹」。
                badge.label.node.active = !empty || Math.sin(time * 10) > -0.35;
                const ratio = Math.min(1, this.economy.ammo / this.ammoCap);
                badge.fill.setScale(ratio, 1, 1);
                badge.fill.setPosition(-116 * (1 - ratio) / 2, -21, 0);
            }
        }

        for (let i = this.floats.length - 1; i >= 0; i -= 1) {
            const item = this.floats[i];
            item.life -= deltaTime;
            if (item.life <= 0) {
                item.node.destroy();
                this.floats.splice(i, 1);
                continue;
            }
            const progress = 1 - item.life / FLOAT_LIFE;
            const pos = item.node.getPosition();
            item.node.setPosition(pos.x, pos.y + FLOAT_RISE * deltaTime, 0);
            item.opacity.opacity = progress < 0.25 ? 255 : Math.max(0, 255 * (1 - (progress - 0.25) / 0.75));
        }
    }

    // 世界坐标 → UI 飘字（一次投影后在 UI 空间上升淡出）。
    private spawnFloat(text: string, color: Color, worldX: number, worldZ: number): void {
        const camera = this.context?.camera3d ?? null;
        const ui = this.context?.ui ?? null;
        if (!camera || !ui || !this.layer) {
            return;
        }
        camera.convertToUINode(v3(worldX, 1.2, worldZ), ui, this.projected);
        const node = createNode('FloatText', this.layer, this.projected.x, this.projected.y);
        createLabel('Text', node, 0, 0, text, 34, color);
        const opacity = node.addComponent(UIOpacity);
        opacity.opacity = 255;
        this.floats.push({ node, opacity, life: FLOAT_LIFE });
    }
}
