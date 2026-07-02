import { Color, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { buildEndCard, EndCardHandles } from '../common/EndCard';
import { DESIGN_HEIGHT, DESIGN_WIDTH, toH, toW, toX, toY } from '../common/Layout';
import { createBox, createHandHint, createLabel, createNode } from '../common/PlaceholderFactory';
import { SparkSystem } from '../common/SparkSystem';
import { TOWER_DEFENSE_CONFIG } from './TowerDefenseConfig';
import { TowerDefenseModel } from './TowerDefenseModel';
import { PlayableState } from './TowerDefenseTypes';

const CONFIG = TOWER_DEFENSE_CONFIG;

export interface TowerDefenseFrames {
    readonly background: SpriteFrame | null;
    readonly slot: SpriteFrame | null;
    readonly tower: SpriteFrame | null;
    readonly enemy: SpriteFrame | null;
    readonly button: SpriteFrame | null;
    readonly hand: SpriteFrame | null;
}

// Layout constants in the reference 390x844 web space (see web/playable.js).
const PATH: ReadonlyArray<{ readonly x: number; readonly y: number }> = [
    { x: 196, y: 132 },
    { x: 196, y: 300 },
    { x: 96, y: 402 },
    { x: 196, y: 500 },
    { x: 294, y: 610 },
    { x: 196, y: 724 },
];

const SLOT_LAYOUT = [
    { id: 1, x: 110, y: 586 },
    { id: 2, x: 196, y: 500 },
    { id: 3, x: 282, y: 586 },
] as const;

const SKY = new Color(24, 35, 39, 255);
const PATH_OUTER = new Color(89, 98, 76, 255);
const PATH_INNER = new Color(137, 150, 111, 255);
const SLOT_EMPTY = new Color(43, 52, 52, 255);
const SLOT_BUILT = new Color(74, 163, 91, 255);
const SLOT_PLUS = new Color(201, 211, 187, 255);
const TOWER_BODY = new Color(203, 232, 107, 255);
const TOWER_HEAD = new Color(41, 53, 41, 255);
const ENEMY_BODY = new Color(184, 76, 68, 255);
const HP_BG = new Color(41, 44, 42, 255);
const HP_FILL = new Color(233, 218, 102, 255);
const SHOT = new Color(244, 207, 102, 255);
const PANEL = new Color(13, 18, 18, 199);
const TEXT = new Color(245, 240, 220, 255);

interface SlotView {
    readonly id: number;
    readonly node: Node;
    readonly webX: number;
    readonly webY: number;
    readonly bgSprite: Sprite | null;
    readonly plus: Node;
    readonly tower: Node;
}

interface EnemyNode {
    readonly root: Node;
    readonly hpFill: UITransform;
    lastWebX: number;
    lastWebY: number;
    lastProgress: number;
}

function pointOnPath(progress: number): { x: number; y: number } {
    const scaled = Math.min(progress, 0.999) * (PATH.length - 1);
    const index = Math.floor(scaled);
    const local = scaled - index;
    const from = PATH[index];
    const to = PATH[index + 1];
    return {
        x: from.x + (to.x - from.x) * local,
        y: from.y + (to.y - from.y) * local,
    };
}

// Places a box between two web-space points, used for path segments and shots.
function createSegment(name: string, parent: Node, x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color): Node {
    const ax = toX(x1);
    const ay = toY(y1);
    const bx = toX(x2);
    const by = toY(y2);
    const length = Math.hypot(bx - ax, by - ay);
    const segment = createBox(name, parent, (ax + bx) * 0.5, (ay + by) * 0.5, length + thickness, thickness, color);
    segment.angle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    return segment;
}

export class TowerDefenseView {
    public readonly slots: SlotView[] = [];
    public ctaButton: Node | null = null;

    private frames: TowerDefenseFrames | null = null;
    private enemyLayer: Node | null = null;
    private shotLayer: Node | null = null;
    private sparks: SparkSystem | null = null;
    private hand: Node | null = null;
    private endCard: EndCardHandles | null = null;
    private coinLabel: Label | null = null;
    private healthLabel: Label | null = null;
    private lastCoinText = '';
    private lastHealthText = '';

    private readonly enemyNodes = new Map<number, EnemyNode>();
    private readonly shotNodes = new Map<number, Node>();

    public build(root: Node, frames: TowerDefenseFrames): void {
        this.frames = frames;

        createBox('Background', root, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, SKY, frames.background);
        if (!frames.background) {
            for (let i = 0; i < PATH.length - 1; i += 1) {
                createSegment(`PathOuter${i + 1}`, root, PATH[i].x, PATH[i].y, PATH[i + 1].x, PATH[i + 1].y, toW(58), PATH_OUTER);
            }
            for (let i = 0; i < PATH.length - 1; i += 1) {
                createSegment(`PathInner${i + 1}`, root, PATH[i].x, PATH[i].y, PATH[i + 1].x, PATH[i + 1].y, toW(34), PATH_INNER);
            }
        }

        this.buildSlots(root, frames);
        this.enemyLayer = createNode('Enemies', root, 0, 0);
        this.shotLayer = createNode('Shots', root, 0, 0);
        this.sparks = new SparkSystem(createNode('Fx', root, 0, 0));
        this.buildHud(root);
        this.hand = createHandHint(root, frames.hand);
        this.endCard = buildEndCard(root, {
            title: CONFIG.texts.winTitle,
            subtitle: CONFIG.texts.subtitle,
            ctaText: CONFIG.texts.cta,
            buttonFrame: frames.button,
        });
        this.ctaButton = this.endCard.ctaButton;
    }

    public showTowerBuilt(slotId: number): void {
        const slot = this.slots.find(item => item.id === slotId);
        if (!slot) {
            return;
        }
        if (slot.bgSprite) {
            slot.bgSprite.color = SLOT_BUILT.clone();
        }
        slot.plus.active = false;
        slot.tower.active = true;
        this.sparks?.burst(slot.webX, slot.webY, 14);
    }

    public showEnd(won: boolean): void {
        if (!this.endCard) {
            return;
        }
        this.endCard.title.string = won ? CONFIG.texts.winTitle : CONFIG.texts.failTitle;
        this.endCard.subtitle.string = CONFIG.texts.subtitle;
        this.endCard.root.active = true;
        if (this.hand) {
            this.hand.active = false;
        }
    }

    public tick(deltaTime: number, time: number, model: TowerDefenseModel): void {
        this.syncEnemies(model);
        this.syncShots(model);
        this.tickHand(time, model);
        this.tickHud(model);
        this.sparks?.tick(deltaTime);
    }

    private buildSlots(root: Node, frames: TowerDefenseFrames): void {
        for (const layout of SLOT_LAYOUT) {
            const slot = createNode(`Slot${layout.id}`, root, toX(layout.x), toY(layout.y));
            slot.addComponent(UITransform).setContentSize(toW(76), toW(76));

            const bg = createBox('SlotBg', slot, 0, 0, toW(60), toW(60), SLOT_EMPTY, frames.slot);
            const plus = createLabel('Plus', slot, 0, 0, '+', 44, SLOT_PLUS);

            const tower = createNode('Tower', slot, 0, 0);
            tower.active = false;
            createBox('TowerBody', tower, 0, toW(5), toW(16), toW(46), TOWER_BODY, frames.tower);
            if (!frames.tower) {
                createBox('TowerHead', tower, 0, toW(30), toW(30), toW(30), TOWER_HEAD);
            }

            this.slots.push({
                id: layout.id,
                node: slot,
                webX: layout.x,
                webY: layout.y,
                bgSprite: bg.getComponent(Sprite),
                plus: plus.node,
                tower,
            });
        }
    }

    private buildHud(root: Node): void {
        const hud = createNode('Hud', root, 0, 0);
        createBox('HudPanel', hud, toX(195), toY(56), toW(358), toH(76), PANEL);

        const coinLabel = createLabel('CoinLabel', hud, toX(34), toY(48), `Coins ${CONFIG.startCoins}`, 36, TEXT);
        coinLabel.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
        coinLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.coinLabel = coinLabel;

        const healthLabel = createLabel('HealthLabel', hud, toX(34), toY(76), `Base ${CONFIG.baseHealth}`, 36, TEXT);
        healthLabel.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
        healthLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.healthLabel = healthLabel;

        const message = createLabel('MessageLabel', hud, toX(356), toY(62), CONFIG.texts.hudMessage, 36, TEXT);
        message.node.getComponent(UITransform)?.setAnchorPoint(1, 0.5);
        message.horizontalAlign = Label.HorizontalAlign.RIGHT;
    }

    private createEnemyNode(id: number): EnemyNode {
        const root = createNode(`Enemy${id}`, this.enemyLayer!, 0, 0);
        createBox('Body', root, 0, 0, toW(36), toW(36), ENEMY_BODY, this.frames?.enemy ?? null);
        createBox('HpBg', root, 0, toW(30), toW(44), toH(5), HP_BG);
        const fill = createBox('HpFill', root, -toW(22), toW(30), toW(44), toH(5), HP_FILL);
        const fillTransform = fill.getComponent(UITransform)!;
        fillTransform.setAnchorPoint(0, 0.5);
        return { root, hpFill: fillTransform, lastWebX: 0, lastWebY: 0, lastProgress: 0 };
    }

    private syncEnemies(model: TowerDefenseModel): void {
        const seen = new Set<number>();
        for (const enemy of model.enemies) {
            seen.add(enemy.id);
            let view = this.enemyNodes.get(enemy.id);
            if (!view) {
                view = this.createEnemyNode(enemy.id);
                this.enemyNodes.set(enemy.id, view);
            }
            const point = pointOnPath(enemy.progress);
            view.root.setPosition(toX(point.x), toY(point.y), 0);
            view.hpFill.setContentSize(toW(44) * Math.max(enemy.health / enemy.maxHealth, 0), toH(5));
            view.lastWebX = point.x;
            view.lastWebY = point.y;
            view.lastProgress = enemy.progress;
        }

        for (const [id, view] of Array.from(this.enemyNodes.entries())) {
            if (seen.has(id)) {
                continue;
            }
            if (view.lastProgress < 0.95) {
                this.sparks?.burst(view.lastWebX, view.lastWebY, 10);
            }
            view.root.destroy();
            this.enemyNodes.delete(id);
        }
    }

    private syncShots(model: TowerDefenseModel): void {
        const seen = new Set<number>();
        for (const shot of model.projectiles) {
            seen.add(shot.id);
            if (this.shotNodes.has(shot.id)) {
                continue;
            }
            const slot = this.slots.find(item => item.id === shot.slotId);
            if (!slot) {
                continue;
            }
            const target = pointOnPath(shot.targetProgress);
            const node = createSegment(`Shot${shot.id}`, this.shotLayer!, slot.webX, slot.webY - 30, target.x, target.y, toW(4), SHOT);
            this.shotNodes.set(shot.id, node);
        }

        for (const [id, node] of Array.from(this.shotNodes.entries())) {
            if (!seen.has(id)) {
                node.destroy();
                this.shotNodes.delete(id);
            }
        }
    }

    private tickHand(time: number, model: TowerDefenseModel): void {
        if (!this.hand) {
            return;
        }

        const target = model.state === PlayableState.Running && model.coins > 0
            ? this.slots.find(slot => !model.slots.find(item => item.id === slot.id)?.occupied)
            : undefined;

        if (!target) {
            this.hand.active = false;
            return;
        }

        this.hand.active = true;
        const bob = Math.sin(time * 6) * 8;
        this.hand.setPosition(toX(target.webX + 24), toY(target.webY + 42 + bob), 0);
    }

    private tickHud(model: TowerDefenseModel): void {
        const coinText = `Coins ${model.coins}`;
        if (this.coinLabel && coinText !== this.lastCoinText) {
            this.coinLabel.string = coinText;
            this.lastCoinText = coinText;
        }

        const healthText = `Base ${model.baseHealth}`;
        if (this.healthLabel && healthText !== this.lastHealthText) {
            this.healthLabel.string = healthText;
            this.lastHealthText = healthText;
        }
    }
}
