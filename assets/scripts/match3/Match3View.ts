import { Color, EventTouch, Label, Node, Sprite, SpriteFrame, UITransform, v3 } from 'cc';
import { buildEndCard, EndCardHandles } from '../common/EndCard';
import { DESIGN_HEIGHT, DESIGN_WIDTH, lerp, toH, toW, toX, toY } from '../common/Layout';
import { createBox, createHandHint, createLabel, createNode } from '../common/PlaceholderFactory';
import { SparkSystem } from '../common/SparkSystem';
import { MATCH3_CONFIG } from './Match3Config';
import { Match3Model } from './Match3Model';
import { Match3Phase } from './Match3Types';

const CONFIG = MATCH3_CONFIG;

export interface Match3Frames {
    readonly background: SpriteFrame | null;
    readonly gem: SpriteFrame | null;
    readonly button: SpriteFrame | null;
    readonly hand: SpriteFrame | null;
}

// Layout constants in the reference 390x844 web space.
const BOARD_CENTER_X = 195;
const BOARD_CENTER_Y = 430;
const CELL_PITCH = 56;
const GEM_SIZE = 48;

const SKY = new Color(28, 24, 38, 255);
const BOARD_BG = new Color(18, 15, 26, 220);
const PANEL = new Color(12, 17, 18, 184);
const TEXT_WHITE = new Color(255, 255, 255, 255);
const SELECT_RING = new Color(255, 245, 196, 200);
const GEM_COLORS: readonly Color[] = [
    new Color(224, 82, 82, 255),
    new Color(82, 176, 224, 255),
    new Color(111, 206, 103, 255),
    new Color(224, 201, 82, 255),
    new Color(176, 111, 224, 255),
];

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

export class Match3View {
    private rootTransform: UITransform | null = null;
    private inputLayer: Node | null = null;
    private selection: Node | null = null;
    private sparks: SparkSystem | null = null;
    private hand: Node | null = null;
    private endCard: EndCardHandles | null = null;
    private scoreLabel: Label | null = null;
    private movesLabel: Label | null = null;
    private lastScoreText = '';
    private lastMovesText = '';

    private readonly gemSprites: Array<Sprite | null> = [];
    private readonly gemNodes: Node[] = [];
    private readonly pops: Pop[] = [];
    private tapCallback: ((cell: number) => void) | null = null;

    private readonly onTouchEnd = (event: EventTouch): void => this.handleTouchEnd(event);

    public get ctaButton(): Node | null {
        return this.endCard?.ctaButton ?? null;
    }

    public build(root: Node, frames: Match3Frames): void {
        this.rootTransform = root.getComponent(UITransform);

        createBox('Background', root, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, SKY, frames.background);
        createBox('BoardBg', root, toX(BOARD_CENTER_X), toY(BOARD_CENTER_Y), toW(CELL_PITCH * CONFIG.columns + 20), toW(CELL_PITCH * CONFIG.rows + 20), BOARD_BG);

        const board = createNode('Board', root, 0, 0);
        for (let cell = 0; cell < CONFIG.columns * CONFIG.rows; cell += 1) {
            const gem = createBox(`Gem${cell}`, board, toX(cellWebX(cell)), toY(cellWebY(cell)), toW(GEM_SIZE), toW(GEM_SIZE), GEM_COLORS[0], frames.gem);
            this.gemNodes.push(gem);
            this.gemSprites.push(gem.getComponent(Sprite));
        }

        const selection = createBox('Selection', root, 0, 0, toW(GEM_SIZE + 10), toW(GEM_SIZE + 10), SELECT_RING);
        selection.active = false;
        this.selection = selection;

        this.sparks = new SparkSystem(createNode('Fx', root, 0, 0));

        const hud = createNode('Hud', root, 0, 0);
        createBox('HudPanel', hud, toX(195), toY(48), toW(358), toH(46), PANEL);
        const score = createLabel('ScoreLabel', hud, toX(34), toY(48), `${CONFIG.texts.scorePrefix}0`, 33, TEXT_WHITE);
        score.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
        score.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.scoreLabel = score;

        const moves = createLabel('MovesLabel', hud, toX(356), toY(48), `${CONFIG.texts.movesPrefix}${CONFIG.moves}`, 33, TEXT_WHITE);
        moves.node.getComponent(UITransform)?.setAnchorPoint(1, 0.5);
        moves.horizontalAlign = Label.HorizontalAlign.RIGHT;
        this.movesLabel = moves;

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

    public enableInput(onCellTap: (cell: number) => void): void {
        this.tapCallback = onCellTap;
        this.inputLayer?.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    public disableInput(): void {
        this.tapCallback = null;
        this.inputLayer?.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    public refresh(model: Match3Model): void {
        model.board.forEach((color, cell) => {
            const sprite = this.gemSprites[cell];
            if (sprite) {
                sprite.color = GEM_COLORS[Math.max(0, color) % GEM_COLORS.length].clone();
            }
        });
    }

    public setSelected(cell: number | null): void {
        if (!this.selection) {
            return;
        }
        if (cell === null) {
            this.selection.active = false;
            return;
        }
        this.selection.active = true;
        this.selection.setPosition(toX(cellWebX(cell)), toY(cellWebY(cell)), 0);
    }

    public celebrate(cells: readonly number[]): void {
        for (const cell of cells) {
            this.sparks?.burst(cellWebX(cell), cellWebY(cell), 6);
            this.pops.push({ node: this.gemNodes[cell], t: 0 });
        }
    }

    public showEnd(won: boolean): void {
        if (this.hand) {
            this.hand.active = false;
        }
        this.setSelected(null);
        if (this.endCard) {
            this.endCard.title.string = won ? CONFIG.texts.winTitle : CONFIG.texts.failTitle;
            this.endCard.root.active = true;
        }
    }

    public tick(deltaTime: number, time: number, model: Match3Model): void {
        this.sparks?.tick(deltaTime);
        this.tickPops(deltaTime);
        this.tickHand(time, model);
        this.tickHud(model);
    }

    private handleTouchEnd(event: EventTouch): void {
        if (!this.tapCallback) {
            return;
        }
        const ui = event.getUILocation();
        const local = this.rootTransform
            ? this.rootTransform.convertToNodeSpaceAR(v3(ui.x, ui.y, 0))
            : { x: ui.x - DESIGN_WIDTH * 0.5, y: ui.y - DESIGN_HEIGHT * 0.5 };

        let best: number | null = null;
        let bestDistance = toW(30);
        for (let cell = 0; cell < CONFIG.columns * CONFIG.rows; cell += 1) {
            const distance = Math.hypot(local.x - toX(cellWebX(cell)), local.y - toY(cellWebY(cell)));
            if (distance < bestDistance) {
                bestDistance = distance;
                best = cell;
            }
        }
        if (best !== null) {
            this.tapCallback(best);
        }
    }

    private tickPops(deltaTime: number): void {
        for (let i = this.pops.length - 1; i >= 0; i -= 1) {
            const pop = this.pops[i];
            pop.t += deltaTime;
            const progress = Math.min(pop.t / 0.25, 1);
            const scale = 1 + 0.3 * (1 - progress);
            pop.node.setScale(scale, scale, 1);
            if (progress >= 1) {
                pop.node.setScale(1, 1, 1);
                this.pops.splice(i, 1);
            }
        }
    }

    private tickHand(time: number, model: Match3Model): void {
        if (!this.hand) {
            return;
        }
        if (model.phase !== Match3Phase.Play) {
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
        const webX = lerp(cellWebX(hint.a), cellWebX(hint.b), u);
        const webY = lerp(cellWebY(hint.a), cellWebY(hint.b), u);
        this.hand.setPosition(toX(webX + 20), toY(webY + 34), 0);
    }

    private tickHud(model: Match3Model): void {
        const scoreText = `${CONFIG.texts.scorePrefix}${model.score}`;
        if (this.scoreLabel && scoreText !== this.lastScoreText) {
            this.scoreLabel.string = scoreText;
            this.lastScoreText = scoreText;
        }

        const movesText = `${CONFIG.texts.movesPrefix}${model.movesLeft}`;
        if (this.movesLabel && movesText !== this.lastMovesText) {
            this.movesLabel.string = movesText;
            this.lastMovesText = movesText;
        }
    }
}
