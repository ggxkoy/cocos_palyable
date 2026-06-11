import { Color, Label, Node, Sprite, SpriteFrame, UIOpacity, UITransform } from 'cc';
import { GoldRushPhase, GoldRushSnapshot } from './GoldRushTypes';
import { createBox, createLabel, createNode } from './PlaceholderFactory';

export interface GoldRushFrames {
    readonly background: SpriteFrame | null;
    readonly crate: SpriteFrame | null;
    readonly base: SpriteFrame | null;
    readonly soldier: SpriteFrame | null;
    readonly enemy: SpriteFrame | null;
    readonly coin: SpriteFrame | null;
    readonly button: SpriteFrame | null;
    readonly hand: SpriteFrame | null;
}

// All layout constants live in the reference 390x844 web coordinate space
// (origin top-left, y down) and are converted to the 720x1280 design space.
const WEB_WIDTH = 390;
const WEB_HEIGHT = 844;
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
const SCALE_X = DESIGN_WIDTH / WEB_WIDTH;
const SCALE_Y = DESIGN_HEIGHT / WEB_HEIGHT;

const COIN_TARGET_X = 72;
const COIN_TARGET_Y = 82;
const SPARK_GRAVITY = 260;

const SKY = new Color(29, 42, 52, 255);
const GROUND = new Color(38, 59, 52, 255);
const PATH = new Color(235, 213, 146, 46);
const BASE_BODY = new Color(38, 50, 58, 255);
const BASE_TOP_PLAIN = new Color(121, 140, 145, 255);
const BASE_TOP_GOLD = new Color(214, 181, 96, 255);
const BASE_DOOR = new Color(23, 34, 40, 255);
const FLAG = new Color(244, 203, 66, 255);
const GLOW = new Color(255, 220, 80, 80);
const CRATE = new Color(182, 109, 47, 255);
const PLANK = new Color(255, 214, 92, 255);
const ENEMY = new Color(92, 108, 92, 255);
const ENEMY_DARK = new Color(39, 49, 38, 255);
const SOLDIER = new Color(61, 93, 122, 255);
const SKIN = new Color(217, 176, 128, 255);
const GUN = new Color(23, 27, 31, 255);
const GOLD = new Color(255, 216, 95, 255);
const FLASH = new Color(255, 214, 107, 255);
const PANEL = new Color(12, 17, 18, 184);
const PANEL_SOFT = new Color(12, 17, 18, 158);
const TEXT_GOLD = new Color(255, 245, 196, 255);
const TEXT_TEAL = new Color(216, 239, 231, 255);
const TEXT_WHITE = new Color(255, 255, 255, 255);
const BUTTON_GOLD = new Color(233, 185, 63, 255);
const BUTTON_TEXT = new Color(34, 26, 9, 255);
const BUTTON_SUB_TEXT = new Color(70, 52, 13, 255);
const OVERLAY = new Color(5, 7, 8, 148);
const CARD = new Color(32, 40, 48, 255);
const CARD_TITLE = new Color(255, 242, 163, 255);
const CARD_SUB = new Color(231, 236, 236, 255);
const CARD_BUILDING = new Color(45, 56, 64, 255);
const CARD_ROOF = new Color(237, 245, 247, 255);
const CTA_GOLD = new Color(241, 189, 50, 255);
const CTA_TEXT = new Color(32, 24, 4, 255);
const HAND_PALM = new Color(242, 210, 178, 255);
const HAND_TIP = new Color(255, 243, 223, 255);

const MESSAGES: Record<GoldRushPhase, string> = {
    [GoldRushPhase.Collect]: 'Tap the shining crates',
    [GoldRushPhase.Upgrade]: 'Upgrade the command base',
    [GoldRushPhase.Battle]: 'Reinforcements deployed',
    [GoldRushPhase.End]: 'Victory unlocked',
};

interface CrateLayout {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    readonly r: number;
    readonly pulse: number;
}

const CRATE_LAYOUT: readonly CrateLayout[] = [
    { id: 1, x: 108, y: 430, r: 36, pulse: 0.1 },
    { id: 2, x: 205, y: 392, r: 41, pulse: 0.7 },
    { id: 3, x: 292, y: 438, r: 34, pulse: 1.2 },
];

interface CrateView {
    readonly id: number;
    readonly node: Node;
    readonly webX: number;
    readonly webY: number;
    readonly pulse: number;
}

interface SoldierView {
    readonly node: Node;
    readonly flash: Node;
    readonly lane: number;
    readonly webY: number;
    webX: number;
    fire: number;
}

interface EnemyView {
    readonly node: Node;
    readonly opacity: UIOpacity;
    readonly offset: number;
    readonly webY: number;
    webX: number;
}

interface CoinFx {
    readonly node: Node;
    webX: number;
    webY: number;
    delay: number;
    life: number;
    readonly duration: number;
}

interface SparkFx {
    readonly node: Node;
    readonly opacity: UIOpacity;
    webX: number;
    webY: number;
    vx: number;
    vy: number;
    life: number;
    readonly maxLife: number;
}

function toX(webX: number): number {
    return webX * SCALE_X - DESIGN_WIDTH * 0.5;
}

function toY(webY: number): number {
    return DESIGN_HEIGHT * 0.5 - webY * SCALE_Y;
}

function toW(webW: number): number {
    return webW * SCALE_X;
}

function toH(webH: number): number {
    return webH * SCALE_Y;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export class GoldRushView {
    public readonly crates: CrateView[] = [];
    public upgradeButton: Node | null = null;
    public ctaButton: Node | null = null;

    private frames: GoldRushFrames | null = null;
    private fxLayer: Node | null = null;
    private baseRoot: Node | null = null;
    private baseTopSprite: Sprite | null = null;
    private baseFlag: Node | null = null;
    private soldierLayer: Node | null = null;
    private hand: Node | null = null;
    private progressRoot: Node | null = null;
    private progressFill: UITransform | null = null;
    private endCard: Node | null = null;
    private goldLabel: Label | null = null;
    private baseLabel: Label | null = null;
    private messageLabel: Label | null = null;
    private lastGoldText = '';
    private lastBaseText = '';

    private readonly soldiers: SoldierView[] = [];
    private readonly enemies: EnemyView[] = [];
    private readonly coins: CoinFx[] = [];
    private readonly sparks: SparkFx[] = [];

    public build(root: Node, frames: GoldRushFrames): void {
        this.frames = frames;

        this.buildBackground(root, frames);
        this.buildBase(root, frames);
        this.buildCrates(root, frames);
        this.buildEnemies(root, frames);
        this.buildSoldiers(root, frames);
        this.fxLayer = createNode('Fx', root, 0, 0);
        this.buildHud(root, frames);
        this.buildUpgradeButton(root, frames);
        this.buildBattleProgress(root);
        this.buildHandHint(root, frames);
        this.buildEndCard(root, frames);
    }

    public applyPhase(snapshot: GoldRushSnapshot): void {
        const phase = snapshot.phase;
        if (this.messageLabel) {
            this.messageLabel.string = MESSAGES[phase];
        }
        if (this.hand) {
            this.hand.active = phase === GoldRushPhase.Collect || phase === GoldRushPhase.Upgrade;
        }
        if (this.upgradeButton) {
            this.upgradeButton.active = phase === GoldRushPhase.Upgrade;
        }
        if (this.progressRoot) {
            this.progressRoot.active = phase === GoldRushPhase.Battle;
        }
        if (this.soldierLayer) {
            this.soldierLayer.active = phase === GoldRushPhase.Battle || phase === GoldRushPhase.End;
        }
        if (this.endCard) {
            this.endCard.active = phase === GoldRushPhase.End;
        }
    }

    public collectCrate(crateId: number): void {
        const crate = this.crates.find(item => item.id === crateId);
        if (!crate) {
            return;
        }
        crate.node.active = false;
        this.coinBurst(crate.webX, crate.webY);
    }

    public showUpgrade(): void {
        if (this.baseRoot) {
            this.baseRoot.setPosition(0, toH(16), 0);
        }
        if (this.baseTopSprite) {
            this.baseTopSprite.color = BASE_TOP_GOLD.clone();
        }
        if (this.baseFlag) {
            this.baseFlag.active = true;
        }
        this.sparkBurst(195, 534, 34);
    }

    public showVictory(): void {
        this.sparkBurst(195, 338, 42);
    }

    public coinBurst(webX: number, webY: number): void {
        for (let i = 0; i < 8; i += 1) {
            const spawnX = webX + Math.random() * 18 - 9;
            const spawnY = webY + Math.random() * 18 - 9;
            const node = createBox('Coin', this.fxLayer!, toX(spawnX), toY(spawnY), toW(16), toW(16), GOLD, this.frames?.coin ?? null);
            node.active = false;
            this.coins.push({
                node,
                webX: spawnX,
                webY: spawnY,
                delay: i * 0.045,
                life: 0,
                duration: 0.65,
            });
        }
        this.sparkBurst(webX, webY, 18);
    }

    public sparkBurst(webX: number, webY: number, count: number): void {
        for (let i = 0; i < count; i += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 130;
            const node = createBox('Spark', this.fxLayer!, toX(webX), toY(webY), toW(12), toW(12), GOLD);
            const opacity = node.addComponent(UIOpacity);
            this.sparks.push({
                node,
                opacity,
                webX,
                webY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.45 + Math.random() * 0.25,
                maxLife: 0.7,
            });
        }
    }

    public tick(deltaTime: number, time: number, snapshot: GoldRushSnapshot): void {
        this.tickCrates(time);
        this.tickHand(time, snapshot);
        this.tickCoins(deltaTime);
        this.tickSparks(deltaTime);
        this.tickBattle(deltaTime, snapshot);
        this.tickHud(time, snapshot);
    }

    private buildBackground(root: Node, frames: GoldRushFrames): void {
        createBox('Background', root, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, SKY, frames.background);
        if (!frames.background) {
            createBox('Ground', root, 0, toY(687), DESIGN_WIDTH, toH(314), GROUND);
            const path = createBox('Path', root, toX(205), toY(555), toW(416), toH(24), PATH);
            path.angle = 27;
        }
    }

    private buildBase(root: Node, frames: GoldRushFrames): void {
        const base = createNode('Base', root, 0, 0);
        this.baseRoot = base;

        createBox('BaseBody', base, toX(195), toY(551), toW(142), toH(86), BASE_BODY, frames.base);
        const top = createBox('BaseTop', base, toX(195), toY(495), toW(86), toH(54), BASE_TOP_PLAIN);
        this.baseTopSprite = top.getComponent(Sprite);
        if (!frames.base) {
            createBox('BaseDoor', base, toX(195), toY(497), toW(58), toH(22), BASE_DOOR);
        }
        const flag = createBox('BaseFlag', base, toX(194), toY(453), toW(44), toH(34), FLAG);
        flag.active = false;
        this.baseFlag = flag;
    }

    private buildCrates(root: Node, frames: GoldRushFrames): void {
        for (const layout of CRATE_LAYOUT) {
            const crate = createNode(`Crate${layout.id}`, root, toX(layout.x), toY(layout.y));
            const touchArea = crate.addComponent(UITransform);
            touchArea.setContentSize(toW(layout.r * 2 + 40), toW(layout.r * 2 + 40));

            createBox('Glow', crate, 0, 0, toW(layout.r * 3.8), toW(layout.r * 3.8), GLOW);
            createBox('Body', crate, 0, 0, toW(layout.r * 2), toW(layout.r * 1.44), CRATE, frames.crate);
            if (!frames.crate) {
                createBox('PlankV', crate, 0, 0, toW(16), toW(layout.r * 1.44), PLANK);
                createBox('PlankH', crate, 0, 0, toW(layout.r * 2), toW(12), PLANK);
            }

            this.crates.push({
                id: layout.id,
                node: crate,
                webX: layout.x,
                webY: layout.y,
                pulse: layout.pulse,
            });
        }
    }

    private buildEnemies(root: Node, frames: GoldRushFrames): void {
        const layout = [
            { x: 410, y: 482, offset: 0 },
            { x: 450, y: 522, offset: 0.25 },
            { x: 490, y: 562, offset: 0.5 },
        ];

        layout.forEach((entry, index) => {
            const enemy = createNode(`Enemy${index + 1}`, root, toX(entry.x), toY(entry.y));
            const opacity = enemy.addComponent(UIOpacity);
            createBox('Head', enemy, 0, 0, toW(36), toW(36), ENEMY, frames.enemy);
            if (!frames.enemy) {
                createBox('Body', enemy, 0, -toW(22), toW(24), toW(18), ENEMY_DARK);
            }
            this.enemies.push({
                node: enemy,
                opacity,
                offset: entry.offset,
                webX: entry.x,
                webY: entry.y,
            });
        });
    }

    private buildSoldiers(root: Node, frames: GoldRushFrames): void {
        const layer = createNode('Soldiers', root, 0, 0);
        layer.active = false;
        this.soldierLayer = layer;

        const layout = [
            { x: 142, y: 600, lane: -1, fire: 0 },
            { x: 195, y: 615, lane: 0, fire: 0.25 },
            { x: 248, y: 600, lane: 1, fire: 0.5 },
        ];

        layout.forEach((entry, index) => {
            const soldier = createNode(`Soldier${index + 1}`, layer, toX(entry.x), toY(entry.y));
            createBox('Body', soldier, 0, 0, toW(26), toW(36), SOLDIER, frames.soldier);
            if (!frames.soldier) {
                createBox('Head', soldier, 0, toW(28), toW(22), toW(22), SKIN);
                const gun = createBox('Gun', soldier, toW(21), toW(16), toW(28), toW(5), GUN);
                gun.angle = 17;
            }
            const flash = createBox('MuzzleFlash', soldier, toW(38), toW(22), toW(16), toW(16), FLASH);
            flash.active = false;

            this.soldiers.push({
                node: soldier,
                flash,
                lane: entry.lane,
                webX: entry.x,
                webY: entry.y,
                fire: entry.fire,
            });
        });
    }

    private buildHud(root: Node, frames: GoldRushFrames): void {
        const hud = createNode('Hud', root, 0, 0);

        createBox('GoldPanel', hud, toX(97), toY(47), toW(150), toH(46), PANEL);
        createBox('CoinIcon', hud, toX(48), toY(47), toW(24), toW(24), GOLD, frames.coin);
        const goldLabel = createLabel('GoldLabel', hud, toX(80), toY(48), '0', 40, TEXT_GOLD);
        goldLabel.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
        goldLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.goldLabel = goldLabel;

        createBox('BasePanel', hud, toX(293), toY(47), toW(150), toH(46), PANEL_SOFT);
        this.baseLabel = createLabel('BaseLabel', hud, toX(293), toY(48), 'Base Lv.1', 33, TEXT_TEAL);

        this.messageLabel = createLabel('MessageLabel', hud, toX(195), toY(116), MESSAGES[GoldRushPhase.Collect], 40, TEXT_WHITE);
    }

    private buildUpgradeButton(root: Node, frames: GoldRushFrames): void {
        const button = createNode('UpgradeButton', root, toX(195), toY(738));
        button.addComponent(UITransform).setContentSize(toW(250), toH(68));
        createBox('ButtonBg', button, 0, 0, toW(250), toH(68), BUTTON_GOLD, frames.button);
        createLabel('ButtonTitle', button, 0, toH(7), 'UPGRADE', 44, BUTTON_TEXT);
        createLabel('ButtonSub', button, 0, -toH(18), 'Spend 75 gold', 28, BUTTON_SUB_TEXT);
        button.active = false;
        this.upgradeButton = button;
    }

    private buildBattleProgress(root: Node): void {
        const progress = createNode('BattleProgress', root, 0, 0);
        progress.active = false;
        this.progressRoot = progress;

        createBox('ProgressBg', progress, toX(195), toY(697), toW(274), toH(22), PANEL);
        const fill = createBox('ProgressFill', progress, toX(62), toY(697), 0, toH(14), GOLD);
        const fillTransform = fill.getComponent(UITransform);
        fillTransform?.setAnchorPoint(0, 0.5);
        this.progressFill = fillTransform;
    }

    private buildHandHint(root: Node, frames: GoldRushFrames): void {
        const hand = createNode('HandHint', root, 0, 0);
        if (frames.hand) {
            createBox('HandSprite', hand, 0, 0, toW(46), toW(64), TEXT_WHITE, frames.hand);
        } else {
            createBox('Palm', hand, toW(2), toW(5), toW(20), toW(50), HAND_PALM);
            createBox('Tip', hand, toW(4), -toW(26), toW(38), toW(38), HAND_TIP);
        }
        hand.angle = 20;
        this.hand = hand;
    }

    private buildEndCard(root: Node, frames: GoldRushFrames): void {
        const card = createNode('EndCard', root, 0, 0);
        card.active = false;
        this.endCard = card;

        const overlay = createBox('Overlay', card, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, OVERLAY);
        // Swallow taps behind the end card so only the CTA reacts.
        overlay.on(Node.EventType.TOUCH_END, () => undefined);

        createBox('Card', card, toX(195), toY(391), toW(302), toH(446), CARD);
        createLabel('VictoryLabel', card, toX(195), toY(230), 'VICTORY', 70, CARD_TITLE);
        createLabel('VictorySub', card, toX(195), toY(282), 'Gold secured. Base upgraded.', 35, CARD_SUB);

        createBox('Medal', card, toX(195), toY(398), toW(152), toW(152), GOLD, frames.coin);
        createBox('Building', card, toX(195), toY(409), toW(106), toH(82), CARD_BUILDING);
        createBox('Roof', card, toX(195), toY(366), toW(66), toH(44), CARD_ROOF);

        const cta = createNode('CtaButton', card, toX(195), toY(735));
        cta.addComponent(UITransform).setContentSize(toW(262), toH(70));
        createBox('CtaBg', cta, 0, 0, toW(262), toH(70), CTA_GOLD, frames.button);
        createLabel('CtaLabel', cta, 0, 0, 'PLAY NOW', 48, CTA_TEXT);
        this.ctaButton = cta;
    }

    private tickCrates(time: number): void {
        for (const crate of this.crates) {
            if (!crate.node.active) {
                continue;
            }
            const pulse = 1 + Math.sin(time * 4 + crate.pulse) * 0.08;
            crate.node.setScale(pulse, pulse, 1);
        }
    }

    private tickHand(time: number, snapshot: GoldRushSnapshot): void {
        if (!this.hand || !this.hand.active) {
            return;
        }

        let webX = 205;
        let webY = 424;
        if (snapshot.phase === GoldRushPhase.Collect) {
            const target = this.crates.find(crate => crate.node.active);
            if (target) {
                webX = target.webX + 24;
                webY = target.webY + 42;
            }
        } else if (snapshot.phase === GoldRushPhase.Upgrade) {
            webX = 70 + 250 * 0.72;
            webY = 704 + 46;
        }

        const bob = Math.sin(time * 6) * 8;
        this.hand.setPosition(toX(webX), toY(webY + bob), 0);
    }

    private tickCoins(deltaTime: number): void {
        for (let i = this.coins.length - 1; i >= 0; i -= 1) {
            const coin = this.coins[i];
            if (coin.delay > 0) {
                coin.delay -= deltaTime;
                continue;
            }
            coin.node.active = true;
            coin.life += deltaTime;
            const t = clamp(coin.life / coin.duration, 0, 1);
            coin.webX = lerp(coin.webX, COIN_TARGET_X, t * 0.18);
            coin.webY = lerp(coin.webY, COIN_TARGET_Y, t * 0.18);
            coin.node.setPosition(toX(coin.webX), toY(coin.webY), 0);

            if (coin.life >= coin.duration) {
                coin.node.destroy();
                this.coins.splice(i, 1);
            }
        }
    }

    private tickSparks(deltaTime: number): void {
        for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
            const spark = this.sparks[i];
            spark.life -= deltaTime;
            if (spark.life <= 0) {
                spark.node.destroy();
                this.sparks.splice(i, 1);
                continue;
            }
            spark.webX += spark.vx * deltaTime;
            spark.webY += spark.vy * deltaTime;
            spark.vy += SPARK_GRAVITY * deltaTime;

            const alpha = clamp(spark.life / spark.maxLife, 0, 1);
            spark.node.setPosition(toX(spark.webX), toY(spark.webY), 0);
            spark.node.setScale(0.5 + alpha * 0.5, 0.5 + alpha * 0.5, 1);
            spark.opacity.opacity = Math.round(alpha * 255);
        }
    }

    private tickBattle(deltaTime: number, snapshot: GoldRushSnapshot): void {
        if (snapshot.phase === GoldRushPhase.Battle) {
            for (const soldier of this.soldiers) {
                soldier.webX = lerp(soldier.webX, 250 + soldier.lane * 18, deltaTime * 1.3);
                soldier.fire = (soldier.fire + deltaTime * 5) % 1;
                soldier.node.setPosition(toX(soldier.webX), toY(soldier.webY), 0);
                soldier.flash.active = soldier.fire < 0.18;
            }
            for (const enemy of this.enemies) {
                enemy.webX = lerp(enemy.webX, 250 + enemy.offset * 18, deltaTime * 0.75);
                enemy.node.setPosition(toX(enemy.webX), toY(enemy.webY), 0);
            }
        }

        if (snapshot.phase === GoldRushPhase.Battle || snapshot.phase === GoldRushPhase.End) {
            for (const enemy of this.enemies) {
                const over = snapshot.battleProgress - 0.55 - enemy.offset * 0.3;
                const alpha = over > 0 ? 1 - clamp(over * 4, 0, 1) : 1;
                enemy.opacity.opacity = Math.round(alpha * 255);
            }
            for (const soldier of this.soldiers) {
                if (snapshot.phase === GoldRushPhase.End) {
                    soldier.flash.active = false;
                }
            }
        }

        if (this.progressFill && snapshot.phase === GoldRushPhase.Battle) {
            this.progressFill.setContentSize(toW(266) * snapshot.battleProgress, toH(14));
        }
    }

    private tickHud(time: number, snapshot: GoldRushSnapshot): void {
        const goldText = String(snapshot.gold);
        if (this.goldLabel && goldText !== this.lastGoldText) {
            this.goldLabel.string = goldText;
            this.lastGoldText = goldText;
        }

        const baseText = `Base Lv.${snapshot.upgradeLevel + 1}`;
        if (this.baseLabel && baseText !== this.lastBaseText) {
            this.baseLabel.string = baseText;
            this.lastBaseText = baseText;
        }

        if (this.upgradeButton && this.upgradeButton.active) {
            const pulse = 1 + Math.sin(time * 5) * 0.04;
            this.upgradeButton.setScale(pulse, pulse, 1);
        }
    }
}
