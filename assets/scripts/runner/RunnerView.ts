import { Color, EventTouch, Label, Node, SpriteFrame, UITransform, v3 } from 'cc';
import { buildEndCard, EndCardHandles } from '../common/EndCard';
import { DESIGN_HEIGHT, DESIGN_WIDTH, clamp, lerp, toH, toW, toX, toY } from '../common/Layout';
import { createBox, createHandHint, createLabel, createNode } from '../common/PlaceholderFactory';
import { SparkSystem } from '../common/SparkSystem';
import { RUNNER_CONFIG } from './RunnerConfig';
import { RunnerModel } from './RunnerModel';
import { RoadItem } from './RunnerTypes';

const CONFIG = RUNNER_CONFIG;

export interface RunnerFrames {
    readonly background: SpriteFrame | null;
    readonly player: SpriteFrame | null;
    readonly obstacle: SpriteFrame | null;
    readonly coin: SpriteFrame | null;
    readonly button: SpriteFrame | null;
    readonly hand: SpriteFrame | null;
}

// Layout constants in the reference 390x844 web space.
const ROAD_CENTER_X = 195;
const ROAD_WIDTH = 300;
const LANE_OFFSET = 95;
const PLAYER_Y = 700;
const ITEM_TRAVEL_START = -60;
const ITEM_TRAVEL_SPAN = 880;

const GRASS = new Color(26, 38, 30, 255);
const ROAD = new Color(43, 47, 54, 255);
const LANE_LINE = new Color(88, 97, 112, 255);
const PLAYER_BODY = new Color(61, 109, 176, 255);
const PLAYER_ROOF = new Color(156, 195, 238, 255);
const OBSTACLE = new Color(184, 76, 68, 255);
const OBSTACLE_STRIPE = new Color(240, 220, 130, 255);
const COIN = new Color(255, 216, 95, 255);
const PANEL = new Color(12, 17, 18, 184);
const TEXT_WHITE = new Color(255, 255, 255, 255);

function laneWebX(lane: number): number {
    return ROAD_CENTER_X + lane * LANE_OFFSET;
}

function itemWebY(progress: number): number {
    return ITEM_TRAVEL_START + progress * ITEM_TRAVEL_SPAN;
}

export class RunnerView {
    private frames: RunnerFrames | null = null;
    private rootTransform: UITransform | null = null;
    private inputLayer: Node | null = null;
    private itemLayer: Node | null = null;
    private player: Node | null = null;
    private playerWebX: number = laneWebX(0);
    private sparks: SparkSystem | null = null;
    private hand: Node | null = null;
    private hintDismissed = false;
    private endCard: EndCardHandles | null = null;
    private coinLabel: Label | null = null;
    private timeLabel: Label | null = null;
    private lastCoinText = '';
    private lastTimeText = '';
    private lastCoins = 0;

    private readonly itemNodes = new Map<number, Node>();
    private tapCallback: ((direction: -1 | 1) => void) | null = null;

    private readonly onTouchEnd = (event: EventTouch): void => this.handleTouchEnd(event);

    public get ctaButton(): Node | null {
        return this.endCard?.ctaButton ?? null;
    }

    public build(root: Node, frames: RunnerFrames): void {
        this.frames = frames;
        this.rootTransform = root.getComponent(UITransform);

        createBox('Background', root, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, GRASS, frames.background);
        if (!frames.background) {
            createBox('Road', root, toX(ROAD_CENTER_X), 0, toW(ROAD_WIDTH), DESIGN_HEIGHT, ROAD);
            createBox('LaneLineLeft', root, toX(ROAD_CENTER_X - LANE_OFFSET / 2), 0, toW(4), DESIGN_HEIGHT, LANE_LINE);
            createBox('LaneLineRight', root, toX(ROAD_CENTER_X + LANE_OFFSET / 2), 0, toW(4), DESIGN_HEIGHT, LANE_LINE);
        }

        this.itemLayer = createNode('Items', root, 0, 0);

        const player = createNode('Player', root, toX(this.playerWebX), toY(PLAYER_Y));
        createBox('Body', player, 0, 0, toW(56), toW(72), PLAYER_BODY, frames.player);
        if (!frames.player) {
            createBox('Roof', player, 0, toW(10), toW(40), toW(24), PLAYER_ROOF);
        }
        this.player = player;

        this.sparks = new SparkSystem(createNode('Fx', root, 0, 0));

        const hud = createNode('Hud', root, 0, 0);
        createBox('HudPanel', hud, toX(195), toY(48), toW(358), toH(46), PANEL);
        const coins = createLabel('CoinLabel', hud, toX(34), toY(48), `${CONFIG.texts.scorePrefix}0`, 33, TEXT_WHITE);
        coins.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
        coins.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.coinLabel = coins;

        const time = createLabel('TimeLabel', hud, toX(356), toY(48), `${CONFIG.texts.timePrefix}${CONFIG.duration}`, 33, TEXT_WHITE);
        time.node.getComponent(UITransform)?.setAnchorPoint(1, 0.5);
        time.horizontalAlign = Label.HorizontalAlign.RIGHT;
        this.timeLabel = time;

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

    public enableInput(onTap: (direction: -1 | 1) => void): void {
        this.tapCallback = onTap;
        this.inputLayer?.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    public disableInput(): void {
        this.tapCallback = null;
        this.inputLayer?.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    public showEnd(won: boolean): void {
        if (this.hand) {
            this.hand.active = false;
        }
        if (!won) {
            this.sparks?.burst(this.playerWebX, PLAYER_Y, 26);
        }
        if (this.endCard) {
            this.endCard.title.string = won ? CONFIG.texts.winTitle : CONFIG.texts.failTitle;
            this.endCard.root.active = true;
        }
    }

    public tick(deltaTime: number, time: number, model: RunnerModel): void {
        this.syncItems(model);
        this.tickPlayer(deltaTime, model);
        this.tickHand(time);
        this.tickHud(model);
        this.sparks?.tick(deltaTime);

        if (model.coins > this.lastCoins) {
            this.sparks?.burst(this.playerWebX, PLAYER_Y - 40, 10);
        }
        this.lastCoins = model.coins;
    }

    private createItemNode(item: RoadItem): Node {
        if (item.kind === 'coin') {
            const coin = createBox(`Coin${item.id}`, this.itemLayer!, 0, 0, toW(36), toW(36), COIN, this.frames?.coin ?? null);
            if (!this.frames?.coin) {
                coin.angle = 45;
            }
            return coin;
        }

        const obstacle = createBox(`Obstacle${item.id}`, this.itemLayer!, 0, 0, toW(70), toW(56), OBSTACLE, this.frames?.obstacle ?? null);
        if (!this.frames?.obstacle) {
            createBox('Stripe', obstacle, 0, 0, toW(70), toW(10), OBSTACLE_STRIPE);
        }
        return obstacle;
    }

    private syncItems(model: RunnerModel): void {
        const seen = new Set<number>();
        for (const item of model.items) {
            seen.add(item.id);
            let node = this.itemNodes.get(item.id);
            if (!node) {
                node = this.createItemNode(item);
                this.itemNodes.set(item.id, node);
            }
            node.setPosition(toX(laneWebX(item.lane)), toY(itemWebY(item.progress)), 0);
        }

        for (const [id, node] of Array.from(this.itemNodes.entries())) {
            if (!seen.has(id)) {
                node.destroy();
                this.itemNodes.delete(id);
            }
        }
    }

    private tickPlayer(deltaTime: number, model: RunnerModel): void {
        if (!this.player) {
            return;
        }
        const target = laneWebX(model.playerLane);
        this.playerWebX = lerp(this.playerWebX, target, Math.min(1, deltaTime * 10));
        this.player.setPosition(toX(this.playerWebX), toY(PLAYER_Y), 0);
        this.player.angle = clamp((this.playerWebX - target) * 0.3, -14, 14);
    }

    private tickHand(time: number): void {
        if (!this.hand || this.hintDismissed) {
            return;
        }
        const left = Math.floor(time / 0.9) % 2 === 0;
        const bob = Math.sin(time * 6) * 8;
        this.hand.setPosition(toX(left ? 110 : 280), toY(770 + bob), 0);
    }

    public dismissHint(): void {
        this.hintDismissed = true;
        if (this.hand) {
            this.hand.active = false;
        }
    }

    private tickHud(model: RunnerModel): void {
        const coinText = `${CONFIG.texts.scorePrefix}${model.coins}`;
        if (this.coinLabel && coinText !== this.lastCoinText) {
            this.coinLabel.string = coinText;
            this.lastCoinText = coinText;
        }

        const timeText = `${CONFIG.texts.timePrefix}${Math.ceil(model.timeLeft)}`;
        if (this.timeLabel && timeText !== this.lastTimeText) {
            this.timeLabel.string = timeText;
            this.lastTimeText = timeText;
        }
    }

    private handleTouchEnd(event: EventTouch): void {
        if (!this.tapCallback) {
            return;
        }
        const ui = event.getUILocation();
        const local = this.rootTransform
            ? this.rootTransform.convertToNodeSpaceAR(v3(ui.x, ui.y, 0))
            : { x: ui.x - DESIGN_WIDTH * 0.5, y: ui.y - DESIGN_HEIGHT * 0.5 };
        this.tapCallback(local.x < 0 ? -1 : 1);
    }
}
