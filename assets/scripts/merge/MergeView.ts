import { Color, EventTouch, Label, Node, SpriteFrame, UITransform, v3 } from 'cc';
import { buildEndCard, EndCardHandles } from '../common/EndCard';
import { DESIGN_HEIGHT, DESIGN_WIDTH, lerp, toW, toX, toY } from '../common/Layout';
import { createBox, createHandHint, createLabel, createNode } from '../common/PlaceholderFactory';
import { SparkSystem } from '../common/SparkSystem';
import { MERGE_CONFIG } from './MergeConfig';
import { MergeModel } from './MergeModel';
import { MergePhase } from './MergeTypes';

const CONFIG = MERGE_CONFIG;

export interface MergeFrames {
    readonly background: SpriteFrame | null;
    readonly cell: SpriteFrame | null;
    readonly item: SpriteFrame | null;
    readonly button: SpriteFrame | null;
    readonly hand: SpriteFrame | null;
}

// Layout constants in the reference 390x844 web space.
const BOARD_CENTER_X = 195;
const BOARD_CENTER_Y = 470;
const CELL_PITCH = 112;
const CELL_SIZE = 104;
const ITEM_SIZE = 88;

const SKY = new Color(34, 30, 44, 255);
const BOARD_BG = new Color(22, 19, 30, 220);
const CELL_BG = new Color(52, 47, 66, 255);
const TEXT_WHITE = new Color(255, 255, 255, 255);
const TEXT_GOLD = new Color(255, 216, 95, 255);
const ITEM_TEXT = new Color(24, 22, 30, 255);
const LEVEL_COLORS: readonly Color[] = [
    new Color(138, 143, 152, 255),
    new Color(74, 163, 91, 255),
    new Color(61, 109, 176, 255),
    new Color(233, 185, 63, 255),
    new Color(208, 82, 201, 255),
];

interface ItemView {
    readonly node: Node;
    readonly id: number;
    readonly level: number;
}

interface Pop {
    readonly node: Node;
    t: number;
}

function cellWebX(cell: number): number {
    return BOARD_CENTER_X + ((cell % CONFIG.columns) - (CONFIG.columns - 1) / 2) * CELL_PITCH;
}

function cellWebY(cell: number): number {
    return BOARD_CENTER_Y + (Math.floor(cell / CONFIG.columns) - (CONFIG.rows - 1) / 2) * CELL_PITCH;
}

export class MergeView {
    private frames: MergeFrames | null = null;
    private root: Node | null = null;
    private rootTransform: UITransform | null = null;
    private itemLayer: Node | null = null;
    private inputLayer: Node | null = null;
    private sparks: SparkSystem | null = null;
    private hand: Node | null = null;
    private endCard: EndCardHandles | null = null;
    private progressLabel: Label | null = null;
    private lastProgressText = '';

    private readonly items = new Map<number, ItemView>();
    private readonly pops: Pop[] = [];
    private dragging: { cell: number; node: Node } | null = null;
    private mergeCallback: ((from: number, to: number) => void) | null = null;

    private readonly onTouchStart = (event: EventTouch): void => this.handleTouchStart(event);
    private readonly onTouchMove = (event: EventTouch): void => this.handleTouchMove(event);
    private readonly onTouchEnd = (event: EventTouch): void => this.handleTouchEnd(event);
    private readonly onTouchCancel = (): void => this.releaseDrag();

    public get ctaButton(): Node | null {
        return this.endCard?.ctaButton ?? null;
    }

    public build(root: Node, frames: MergeFrames): void {
        this.frames = frames;
        this.root = root;
        this.rootTransform = root.getComponent(UITransform);

        createBox('Background', root, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, SKY, frames.background);
        createBox('BoardBg', root, toX(BOARD_CENTER_X), toY(BOARD_CENTER_Y), toW(CELL_PITCH * CONFIG.columns + 24), toW(CELL_PITCH * CONFIG.rows + 24), BOARD_BG);

        for (let cell = 0; cell < CONFIG.columns * CONFIG.rows; cell += 1) {
            createBox(`Cell${cell}`, root, toX(cellWebX(cell)), toY(cellWebY(cell)), toW(CELL_SIZE), toW(CELL_SIZE), CELL_BG, frames.cell);
        }

        this.itemLayer = createNode('Items', root, 0, 0);
        this.sparks = new SparkSystem(createNode('Fx', root, 0, 0));

        const hud = createNode('Hud', root, 0, 0);
        this.progressLabel = createLabel('ProgressLabel', hud, toX(195), toY(60), `${CONFIG.texts.progressPrefix}1 / ${CONFIG.targetLevel}`, 33, TEXT_GOLD);
        createLabel('MessageLabel', hud, toX(195), toY(116), CONFIG.texts.hudMessage, 40, TEXT_WHITE);

        this.hand = createHandHint(root, frames.hand);

        const input = createNode('InputLayer', root, 0, 0);
        input.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        this.inputLayer = input;

        this.endCard = buildEndCard(root, {
            title: CONFIG.texts.winTitle,
            subtitle: CONFIG.texts.subtitle,
            ctaText: CONFIG.texts.cta,
            buttonFrame: frames.button,
        });
    }

    public enableInput(onMerge: (from: number, to: number) => void): void {
        this.mergeCallback = onMerge;
        if (!this.inputLayer) {
            return;
        }
        this.inputLayer.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.inputLayer.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.inputLayer.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.inputLayer.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    public disableInput(): void {
        this.mergeCallback = null;
        if (!this.inputLayer) {
            return;
        }
        this.inputLayer.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.inputLayer.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.inputLayer.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.inputLayer.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    public refresh(model: MergeModel): void {
        this.releaseDrag();

        model.cells.forEach((item, cell) => {
            const existing = this.items.get(cell);
            if (!item) {
                if (existing) {
                    existing.node.destroy();
                    this.items.delete(cell);
                }
                return;
            }
            if (existing && existing.id === item.id && existing.level === item.level) {
                return;
            }
            if (existing) {
                existing.node.destroy();
            }

            const node = this.createItemNode(cell, item.level);
            this.items.set(cell, { node, id: item.id, level: item.level });
            this.pops.push({ node, t: 0 });
        });
    }

    public burstAt(cell: number): void {
        this.sparks?.burst(cellWebX(cell), cellWebY(cell), 20);
    }

    public showEnd(): void {
        if (this.hand) {
            this.hand.active = false;
        }
        if (this.endCard) {
            this.endCard.root.active = true;
        }
    }

    public tick(deltaTime: number, time: number, model: MergeModel): void {
        this.sparks?.tick(deltaTime);
        this.tickPops(deltaTime);
        this.tickHand(time, model);
        this.tickHud(model);
    }

    private createItemNode(cell: number, level: number): Node {
        const color = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length) - 1];
        const node = createBox(`Item${cell}`, this.itemLayer!, toX(cellWebX(cell)), toY(cellWebY(cell)), toW(ITEM_SIZE), toW(ITEM_SIZE), color, this.frames?.item ?? null);
        createLabel('Level', node, 0, 0, `${CONFIG.texts.levelPrefix}${level}`, 30, ITEM_TEXT);
        return node;
    }

    private toLocal(event: EventTouch): { x: number; y: number } {
        const ui = event.getUILocation();
        if (!this.rootTransform) {
            return { x: ui.x - DESIGN_WIDTH * 0.5, y: ui.y - DESIGN_HEIGHT * 0.5 };
        }
        const local = this.rootTransform.convertToNodeSpaceAR(v3(ui.x, ui.y, 0));
        return { x: local.x, y: local.y };
    }

    private cellAt(local: { x: number; y: number }): number | null {
        let best: number | null = null;
        let bestDistance = toW(56);
        for (let cell = 0; cell < CONFIG.columns * CONFIG.rows; cell += 1) {
            const distance = Math.hypot(local.x - toX(cellWebX(cell)), local.y - toY(cellWebY(cell)));
            if (distance < bestDistance) {
                bestDistance = distance;
                best = cell;
            }
        }
        return best;
    }

    private handleTouchStart(event: EventTouch): void {
        const cell = this.cellAt(this.toLocal(event));
        if (cell === null) {
            return;
        }
        const item = this.items.get(cell);
        if (!item) {
            return;
        }
        this.dragging = { cell, node: item.node };
        item.node.setSiblingIndex(this.itemLayer!.children.length - 1);
        item.node.setScale(1.12, 1.12, 1);
    }

    private handleTouchMove(event: EventTouch): void {
        if (!this.dragging) {
            return;
        }
        const local = this.toLocal(event);
        this.dragging.node.setPosition(local.x, local.y, 0);
    }

    private handleTouchEnd(event: EventTouch): void {
        if (!this.dragging) {
            return;
        }
        const from = this.dragging.cell;
        const drop = this.cellAt(this.toLocal(event));
        this.releaseDrag();
        if (drop !== null && drop !== from && this.mergeCallback) {
            this.mergeCallback(from, drop);
        }
    }

    private releaseDrag(): void {
        if (!this.dragging) {
            return;
        }
        const item = this.items.get(this.dragging.cell);
        if (item && item.node === this.dragging.node) {
            item.node.setPosition(toX(cellWebX(this.dragging.cell)), toY(cellWebY(this.dragging.cell)), 0);
            item.node.setScale(1, 1, 1);
        }
        this.dragging = null;
    }

    private tickPops(deltaTime: number): void {
        for (let i = this.pops.length - 1; i >= 0; i -= 1) {
            const pop = this.pops[i];
            pop.t += deltaTime;
            const progress = Math.min(pop.t / 0.2, 1);
            const dragged = this.dragging && this.dragging.node === pop.node;
            if (!dragged) {
                const scale = 1 + 0.35 * (1 - progress);
                pop.node.setScale(scale, scale, 1);
            }
            if (progress >= 1) {
                this.pops.splice(i, 1);
            }
        }
    }

    private tickHand(time: number, model: MergeModel): void {
        if (!this.hand) {
            return;
        }
        if (model.phase !== MergePhase.Play || this.dragging) {
            this.hand.active = false;
            return;
        }

        const hint = model.hint();
        if (!hint) {
            this.hand.active = false;
            return;
        }

        this.hand.active = true;
        const u = (Math.sin(time * 2 - Math.PI / 2) + 1) / 2;
        const webX = lerp(cellWebX(hint.from), cellWebX(hint.to), u);
        const webY = lerp(cellWebY(hint.from), cellWebY(hint.to), u);
        this.hand.setPosition(toX(webX + 24), toY(webY + 42), 0);
    }

    private tickHud(model: MergeModel): void {
        const text = `${CONFIG.texts.progressPrefix}${Math.max(model.highestLevel, 1)} / ${CONFIG.targetLevel}`;
        if (this.progressLabel && text !== this.lastProgressText) {
            this.progressLabel.string = text;
            this.lastProgressText = text;
        }
    }
}
