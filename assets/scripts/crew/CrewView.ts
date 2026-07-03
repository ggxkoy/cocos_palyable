import { Color, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { buildEndCard, EndCardHandles } from '../common/EndCard';
import { DESIGN_HEIGHT, DESIGN_WIDTH, toH, toW, toX, toY } from '../common/Layout';
import { createBox, createHandHint, createLabel, createNode } from '../common/PlaceholderFactory';
import { SparkSystem } from '../common/SparkSystem';
import { CREW_CONFIG } from './CrewConfig';
import { CrewModel } from './CrewModel';
import { CrewPhase } from './CrewTypes';

const CONFIG = CREW_CONFIG;

export interface CrewFrames {
    readonly background: SpriteFrame | null;
    readonly vein: SpriteFrame | null;
    readonly depot: SpriteFrame | null;
    readonly worker: SpriteFrame | null;
    readonly button: SpriteFrame | null;
    readonly hand: SpriteFrame | null;
}

const GROUND = new Color(58, 42, 30, 255);
const WATER = new Color(52, 130, 176, 255);
const BRIDGE = new Color(150, 112, 70, 255);
const ZONE_GROUND = new Color(84, 62, 42, 255);
const ZONE_LOCKED = new Color(52, 46, 40, 255);
const LOCK = new Color(30, 26, 22, 255);
const VEIN_GOLD = new Color(232, 170, 48, 255);
const DEPOT = new Color(94, 70, 128, 255);
const DEPOT_STACK = new Color(255, 216, 95, 255);
const WORKER_BODY = new Color(224, 140, 60, 255);
const WORKER_HEAD = new Color(240, 205, 165, 255);
const GOLD = new Color(255, 216, 95, 255);
const PAD = new Color(233, 185, 63, 255);
const PAD_DISABLED = new Color(105, 96, 74, 255);
const PAD_TEXT = new Color(34, 26, 9, 255);
const PANEL = new Color(12, 17, 18, 184);
const TEXT_GOLD = new Color(255, 245, 196, 255);
const TEXT_WHITE = new Color(255, 255, 255, 255);

const MESSAGES: Record<CrewPhase, string> = {
    [CrewPhase.Guide]: CONFIG.texts.guide,
    [CrewPhase.Manage]: CONFIG.texts.manage,
    [CrewPhase.Boom]: CONFIG.texts.boom,
    [CrewPhase.End]: CONFIG.texts.end,
};

interface PadView {
    readonly purchaseId: string;
    readonly node: Node;
    readonly bgSprite: Sprite | null;
    readonly webX: number;
    readonly webY: number;
}

interface ZoneView {
    readonly id: number;
    readonly ground: Sprite | null;
    readonly lock: Node;
}

interface WorkerView {
    readonly node: Node;
    readonly bars: Node[];
}

export class CrewView {
    public readonly pads: PadView[] = [];

    private frames: CrewFrames | null = null;
    private readonly zoneViews: ZoneView[] = [];
    private readonly veinNodes = new Map<number, Node>();
    private readonly workerViews = new Map<number, WorkerView>();
    private workerLayer: Node | null = null;
    private sparks: SparkSystem | null = null;
    private hand: Node | null = null;
    private endCard: EndCardHandles | null = null;
    private goldLabel: Label | null = null;
    private messageLabel: Label | null = null;
    private lastGoldText = '';
    private lastPhase: CrewPhase = CrewPhase.Guide;
    private boomBurstTimer = 0;

    public get ctaButton(): Node | null {
        return this.endCard?.ctaButton ?? null;
    }

    public build(root: Node, frames: CrewFrames): void {
        this.frames = frames;

        createBox('Background', root, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, GROUND, frames.background);
        if (!frames.background) {
            createBox('River', root, 0, toY(470), DESIGN_WIDTH, toH(56), WATER);
            createBox('Bridge', root, toX(195), toY(470), toW(90), toH(64), BRIDGE);
        }

        // 矿区地块 + 矿脉（矿脉节点按 Model 的 id 顺序构建：区域 × 偏移）。
        let veinId = 1;
        for (const zone of CONFIG.stations.zones) {
            const zoneNode = createNode(`Zone${zone.id}`, root, toX(zone.x), toY(zone.y));
            const ground = createBox('ZoneGround', zoneNode, 0, 0, toW(150), toW(112), ZONE_LOCKED);
            for (const offset of CONFIG.stations.veinOffsets) {
                const vein = createBox(`Vein${veinId}`, zoneNode, toW(offset.x), -toW(offset.y), toW(34), toW(26), VEIN_GOLD, frames.vein);
                this.veinNodes.set(veinId, vein);
                veinId += 1;
            }
            const lock = createBox('Lock', zoneNode, 0, 0, toW(34), toW(40), LOCK);
            this.zoneViews.push({ id: zone.id, ground: ground.getComponent(Sprite), lock });
        }

        const depot = CONFIG.stations.depot;
        const depotNode = createNode('Depot', root, toX(depot.x), toY(depot.y));
        createBox('DepotBase', depotNode, 0, 0, toW(150), toW(90), DEPOT, frames.depot);
        createBox('DepotStack', depotNode, 0, toW(10), toW(110), toW(36), DEPOT_STACK);

        this.workerLayer = createNode('Workers', root, 0, 0);
        this.sparks = new SparkSystem(createNode('Fx', root, 0, 0));

        this.buildPads(root, frames);
        this.buildHud(root);
        this.hand = createHandHint(root, frames.hand);

        this.endCard = buildEndCard(root, {
            title: CONFIG.texts.winTitle,
            subtitle: CONFIG.texts.winSubtitle,
            ctaText: CONFIG.texts.cta,
            buttonFrame: frames.button,
        });
    }

    public tick(deltaTime: number, time: number, model: CrewModel): void {
        this.syncWorkers(model);
        this.refreshZones(model);
        this.refreshVeins(model);
        this.refreshPads(model);
        this.tickHand(time, model);
        this.tickHud(model);
        this.tickPhase(model);
        this.tickBoom(deltaTime, model);

        for (const strike of model.drainStrikeEvents()) {
            this.sparks?.burst(strike.x, strike.y, 4);
        }
        for (const deposit of model.drainDepositEvents()) {
            this.sparks?.burst(deposit.x, deposit.y - 10, 8);
        }
        this.sparks?.tick(deltaTime);
    }

    public celebratePurchase(purchaseId: string): void {
        const pad = this.pads.find(item => item.purchaseId === purchaseId);
        if (pad) {
            this.sparks?.burst(pad.webX, pad.webY, 16);
        }
    }

    private buildPads(root: Node, frames: CrewFrames): void {
        for (const entry of CONFIG.purchases) {
            const node = createNode(`Pad-${entry.id}`, root, toX(entry.x), toY(entry.y));
            node.addComponent(UITransform).setContentSize(toW(104), toH(72));
            const bg = createBox('PadBg', node, 0, 0, toW(96), toH(64), PAD, frames.button);
            const kindText = entry.kind === 'hire' ? CONFIG.texts.hireLabel : CONFIG.texts.unlockLabel;
            const costText = entry.cost > 0 ? `${entry.cost}` : CONFIG.texts.freeLabel;
            createLabel('PadLabel', node, 0, 0, `${kindText} ${costText}`, 26, PAD_TEXT);
            this.pads.push({
                purchaseId: entry.id,
                node,
                bgSprite: bg.getComponent(Sprite),
                webX: entry.x,
                webY: entry.y,
            });
        }
    }

    private buildHud(root: Node): void {
        const hud = createNode('Hud', root, 0, 0);
        createBox('GoldPanel', hud, toX(97), toY(47), toW(150), toH(46), PANEL);
        createBox('CoinIcon', hud, toX(48), toY(47), toW(24), toW(24), GOLD);
        const gold = createLabel('GoldLabel', hud, toX(80), toY(48), '0', 40, TEXT_GOLD);
        gold.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
        gold.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.goldLabel = gold;

        this.messageLabel = createLabel('MessageLabel', hud, toX(195), toY(116), MESSAGES[CrewPhase.Guide], 40, TEXT_WHITE);
    }

    private syncWorkers(model: CrewModel): void {
        for (const worker of model.workers) {
            let view = this.workerViews.get(worker.id);
            if (!view) {
                view = this.createWorkerView(worker.id);
                this.workerViews.set(worker.id, view);
            }
            view.node.setPosition(toX(worker.x), toY(worker.y), 0);
            view.bars.forEach((bar, index) => {
                bar.active = worker.carrying > index;
            });
        }
    }

    private createWorkerView(id: number): WorkerView {
        const node = createNode(`Worker${id}`, this.workerLayer!, 0, 0);
        createBox('Body', node, 0, 0, toW(26), toW(34), WORKER_BODY, this.frames?.worker ?? null);
        if (!this.frames?.worker) {
            createBox('Head', node, 0, toW(24), toW(20), toW(20), WORKER_HEAD);
        }
        const bars: Node[] = [];
        for (let i = 0; i < CONFIG.workerCapacity; i += 1) {
            const bar = createBox(`Bar${i}`, node, 0, toW(38 + i * 9), toW(20), toW(7), GOLD);
            bar.active = false;
            bars.push(bar);
        }
        return { node, bars };
    }

    private refreshZones(model: CrewModel): void {
        for (const zone of model.zones) {
            const view = this.zoneViews.find(item => item.id === zone.id);
            if (!view) {
                continue;
            }
            view.lock.active = !zone.unlocked;
            if (view.ground) {
                const target = zone.unlocked ? ZONE_GROUND : ZONE_LOCKED;
                if (!colorEquals(view.ground.color, target)) {
                    view.ground.color = target.clone();
                }
            }
        }
    }

    // 矿脉随库存缩放，敲空即隐藏，重生后恢复。
    private refreshVeins(model: CrewModel): void {
        for (const vein of model.veins) {
            const node = this.veinNodes.get(vein.id);
            if (!node) {
                continue;
            }
            const unlocked = model.zones.find(zone => zone.id === vein.zoneId)?.unlocked ?? false;
            node.active = unlocked && vein.stock > 0;
            if (node.active) {
                const scale = 0.55 + 0.45 * (vein.stock / CONFIG.veinStock);
                node.setScale(scale, scale, 1);
            }
        }
    }

    private refreshPads(model: CrewModel): void {
        // 同一位置可能排多个购买项（依次雇佣），只显示该位置的第一个未购项。
        const shownPositions = new Set<string>();
        for (const pad of this.pads) {
            const purchase = model.purchases.find(item => item.id === pad.purchaseId);
            const key = `${pad.webX},${pad.webY}`;
            const show = !!purchase && !purchase.purchased && !shownPositions.has(key)
                && model.phase !== CrewPhase.Boom && model.phase !== CrewPhase.End;
            pad.node.active = show;
            if (!show) {
                continue;
            }
            shownPositions.add(key);
            if (pad.bgSprite && purchase) {
                const target = model.canAfford(purchase) ? PAD : PAD_DISABLED;
                if (!colorEquals(pad.bgSprite.color, target)) {
                    pad.bgSprite.color = target.clone();
                }
            }
        }
    }

    private tickHand(time: number, model: CrewModel): void {
        if (!this.hand) {
            return;
        }
        const next = model.nextPurchase();
        const pad = next && model.canAfford(next)
            ? this.pads.find(item => item.purchaseId === next.id && item.node.active)
            : undefined;
        if (!pad || model.phase === CrewPhase.Boom || model.phase === CrewPhase.End) {
            this.hand.active = false;
            return;
        }
        this.hand.active = true;
        const bob = Math.sin(time * 6) * 8;
        this.hand.setPosition(toX(pad.webX + 30), toY(pad.webY + 44 + bob), 0);
    }

    private tickHud(model: CrewModel): void {
        const goldText = String(model.gold);
        if (this.goldLabel && goldText !== this.lastGoldText) {
            this.goldLabel.string = goldText;
            this.lastGoldText = goldText;
        }
    }

    private tickPhase(model: CrewModel): void {
        if (model.phase === this.lastPhase) {
            return;
        }
        this.lastPhase = model.phase;
        if (this.messageLabel) {
            this.messageLabel.string = MESSAGES[model.phase];
        }
        if (model.phase === CrewPhase.End && this.endCard) {
            this.endCard.root.active = true;
        }
    }

    // 繁荣演出：boom 期间矿区与仓库轮流喷金。
    private tickBoom(deltaTime: number, model: CrewModel): void {
        if (model.phase !== CrewPhase.Boom) {
            return;
        }
        this.boomBurstTimer -= deltaTime;
        if (this.boomBurstTimer > 0) {
            return;
        }
        this.boomBurstTimer = CONFIG.boomBurstInterval;
        const spots = [
            ...model.zones.filter(zone => zone.unlocked).map(zone => ({ x: zone.x, y: zone.y })),
            CONFIG.stations.depot,
        ];
        const spot = spots[Math.floor(Math.random() * spots.length)];
        this.sparks?.burst(spot.x, spot.y, 14);
    }
}

function colorEquals(a: Color, b: Color): boolean {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}
