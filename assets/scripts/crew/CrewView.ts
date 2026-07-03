import { Color, EventTouch, Label, Node, Sprite, SpriteFrame, UITransform, v3 } from 'cc';
import { buildEndCard, EndCardHandles } from '../common/EndCard';
import { DESIGN_HEIGHT, DESIGN_WIDTH, fromX, fromY, toH, toW, toX, toY } from '../common/Layout';
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
const VAULT_LOCKED = new Color(70, 60, 50, 255);
const VAULT_OPEN = new Color(240, 186, 60, 255);
const VAULT_DOOR = new Color(44, 38, 32, 255);
const DEPOT = new Color(94, 70, 128, 255);
const DEPOT_STACK = new Color(255, 216, 95, 255);
const WORKER_BODY = new Color(224, 140, 60, 255);
const WORKER_HEAD = new Color(240, 205, 165, 255);
const CHIEF_BODY = new Color(61, 109, 176, 255);
const CHIEF_HEAD = new Color(240, 205, 165, 255);
const MOVE_MARKER = new Color(255, 245, 196, 150);
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
    readonly label: Label;
    readonly baseText: string;
    readonly costText: string;
    readonly webX: number;
    readonly webY: number;
    lastText: string;
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
    private rootTransform: UITransform | null = null;
    private chiefNode: Node | null = null;
    private chiefBars: Node[] = [];
    private moveMarker: Node | null = null;
    private inputLayer: Node | null = null;
    private groundCallback: ((webX: number, webY: number) => void) | null = null;
    private readonly onGroundTap = (event: EventTouch): void => this.handleGroundTap(event);
    private vaultBody: Sprite | null = null;
    private vaultLock: Node | null = null;
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
        this.rootTransform = root.getComponent(UITransform);

        createBox('Background', root, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, GROUND, frames.background);
        if (!frames.background) {
            createBox('River', root, 0, toY(470), DESIGN_WIDTH, toH(56), WATER);
            createBox('Bridge', root, toX(195), toY(470), toW(90), toH(64), BRIDGE);
        }

        // 长期锚点：金库从第一帧就矗立在地图顶部，作为整局的终极目标。
        const vault = CONFIG.stations.vault;
        const vaultNode = createNode('Vault', root, toX(vault.x), toY(vault.y));
        const vaultBody = createBox('VaultBody', vaultNode, 0, 0, toW(170), toW(110), VAULT_LOCKED);
        createBox('VaultDoor', vaultNode, 0, -toW(8), toW(64), toW(70), VAULT_DOOR);
        const vaultLock = createBox('VaultLock', vaultNode, 0, toW(4), toW(30), toW(36), LOCK);
        this.vaultBody = vaultBody.getComponent(Sprite);
        this.vaultLock = vaultLock;

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

        // 主角（玩家驱动）：蓝衣、比雇员高一头，配移动目的地标记。
        const spawn = CONFIG.stations.workerSpawn;
        const chief = createNode('Chief', root, toX(spawn.x), toY(spawn.y));
        createBox('Body', chief, 0, 0, toW(30), toW(42), CHIEF_BODY, frames.worker);
        if (!frames.worker) {
            createBox('Head', chief, 0, toW(29), toW(22), toW(22), CHIEF_HEAD);
        }
        this.chiefBars = [];
        for (let i = 0; i < CONFIG.workerCapacity; i += 1) {
            const bar = createBox(`Bar${i}`, chief, 0, toW(45 + i * 9), toW(22), toW(7), GOLD);
            bar.active = false;
            this.chiefBars.push(bar);
        }
        this.chiefNode = chief;

        const marker = createBox('MoveMarker', root, 0, 0, toW(20), toW(20), MOVE_MARKER);
        marker.angle = 45;
        marker.active = false;
        this.moveMarker = marker;

        this.sparks = new SparkSystem(createNode('Fx', root, 0, 0));

        // 地面点击层：在目标牌之下，牌子优先响应，其余点击都是主角移动指令。
        const input = createNode('GroundInput', root, 0, 0);
        input.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        this.inputLayer = input;

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

    public enableGroundInput(onTap: (webX: number, webY: number) => void): void {
        this.groundCallback = onTap;
        this.inputLayer?.on(Node.EventType.TOUCH_END, this.onGroundTap, this);
    }

    public disableGroundInput(): void {
        this.groundCallback = null;
        this.inputLayer?.off(Node.EventType.TOUCH_END, this.onGroundTap, this);
    }

    public tick(deltaTime: number, time: number, model: CrewModel): void {
        this.syncChief(model);
        this.syncWorkers(model);
        this.refreshZones(model);
        this.refreshVeins(model);
        this.refreshVault(model);
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
            const text = `${kindText} ${costText}`;
            const label = createLabel('PadLabel', node, 0, 0, text, 26, PAD_TEXT);
            this.pads.push({
                purchaseId: entry.id,
                node,
                bgSprite: bg.getComponent(Sprite),
                label,
                baseText: kindText,
                costText,
                webX: entry.x,
                webY: entry.y,
                lastText: text,
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

    private handleGroundTap(event: EventTouch): void {
        if (!this.groundCallback) {
            return;
        }
        const ui = event.getUILocation();
        const local = this.rootTransform
            ? this.rootTransform.convertToNodeSpaceAR(v3(ui.x, ui.y, 0))
            : { x: ui.x - DESIGN_WIDTH * 0.5, y: ui.y - DESIGN_HEIGHT * 0.5 };
        this.groundCallback(fromX(local.x), fromY(local.y));
    }

    private syncChief(model: CrewModel): void {
        const chief = model.chief;
        if (this.chiefNode) {
            this.chiefNode.setPosition(toX(chief.x), toY(chief.y), 0);
        }
        this.chiefBars.forEach((bar, index) => {
            bar.active = chief.carrying > index;
        });
        if (this.moveMarker) {
            const hasTarget = chief.moveTargetX !== null && chief.moveTargetY !== null;
            this.moveMarker.active = hasTarget;
            if (hasTarget) {
                this.moveMarker.setPosition(toX(chief.moveTargetX!), toY(chief.moveTargetY!), 0);
            }
        }
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
            if (!purchase) {
                continue;
            }
            const affordable = model.canAfford(purchase);
            if (pad.bgSprite) {
                const target = affordable ? PAD : PAD_DISABLED;
                if (!colorEquals(pad.bgSprite.color, target)) {
                    pad.bgSprite.color = target.clone();
                }
            }
            // 未达标时实时显示「当前金币/价格」，让下一个目标的进度始终可见。
            const text = affordable || purchase.cost === 0
                ? `${pad.baseText} ${pad.costText}`
                : `${pad.baseText} ${model.gold}/${purchase.cost}`;
            if (text !== pad.lastText) {
                pad.label.string = text;
                pad.lastText = text;
            }
        }
    }

    private refreshVault(model: CrewModel): void {
        if (this.vaultLock) {
            this.vaultLock.active = !model.vaultOpened;
        }
        if (this.vaultBody) {
            const target = model.vaultOpened ? VAULT_OPEN : VAULT_LOCKED;
            if (!colorEquals(this.vaultBody.color, target)) {
                this.vaultBody.color = target.clone();
            }
        }
    }

    // 定向引导链：可买目标牌 > 背满去仓库 > 去最近矿脉——始终指向玩家该点的下一处。
    private tickHand(time: number, model: CrewModel): void {
        if (!this.hand) {
            return;
        }
        if (model.phase === CrewPhase.Boom || model.phase === CrewPhase.End) {
            this.hand.active = false;
            return;
        }
        const bob = Math.sin(time * 6) * 8;

        const next = model.nextPurchase();
        if (next && model.canAfford(next)) {
            const pad = this.pads.find(item => item.purchaseId === next.id && item.node.active);
            if (pad) {
                this.hand.active = true;
                this.hand.setPosition(toX(pad.webX + 30), toY(pad.webY + 44 + bob), 0);
                return;
            }
        }

        if (model.chief.carrying >= CONFIG.workerCapacity) {
            const depot = CONFIG.stations.depot;
            this.hand.active = true;
            this.hand.setPosition(toX(depot.x + 30), toY(depot.y + 44 + bob), 0);
            return;
        }

        let target: { x: number; y: number } | null = null;
        let best = Infinity;
        for (const vein of model.veins) {
            if (vein.stock <= 0 || !model.zones.find(zone => zone.id === vein.zoneId)?.unlocked) {
                continue;
            }
            const distance = Math.hypot(vein.x - model.chief.x, vein.y - model.chief.y);
            if (distance < best) {
                best = distance;
                target = vein;
            }
        }
        if (!target) {
            this.hand.active = false;
            return;
        }
        this.hand.active = true;
        this.hand.setPosition(toX(target.x + 26), toY(target.y + 40 + bob), 0);
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
            CONFIG.stations.vault,
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
