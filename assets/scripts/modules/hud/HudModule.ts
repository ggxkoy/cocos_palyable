import { Color, Label, UITransform } from 'cc';
import { toH, toW, toX, toY } from '../../common/Layout';
import { createBox, createLabel, createNode } from '../../common/PlaceholderFactory';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { EconomySim } from '../economy/EconomySim';
import { GoalChainSim, GoalPhase } from '../goalchain/GoalChainSim';

// 2D HUD 叠加层：金币、弹药、阶段提示、下一目标进度（含价格，替代 3D 文字）。
export interface HudTexts {
    readonly guide: string;
    readonly manage: string;
    readonly boom: string;
    readonly end: string;
    readonly hireLabel: string;
    readonly unlockLabel: string;
    readonly vaultLabel: string;
    readonly nextPrefix: string;
    readonly ammoPrefix: string;
}

const PANEL_SHADOW = new Color(3, 8, 10, 220);
const PANEL = new Color(16, 25, 28, 238);
const PANEL_INNER = new Color(28, 42, 45, 245);
const PANEL_LINE = new Color(86, 110, 108, 210);
const GOLD = new Color(247, 183, 49, 255);
const GOLD_DARK = new Color(111, 72, 18, 255);
const AMMO = new Color(73, 214, 183, 255);
const AMMO_DARK = new Color(21, 82, 72, 255);
const DANGER = new Color(228, 72, 52, 255);
const TEXT_GOLD = new Color(255, 225, 142, 255);
const TEXT_MUTED = new Color(157, 181, 177, 255);
const TEXT_WHITE = new Color(255, 255, 255, 255);

export class HudModule implements PlayableModule {
    private goldLabel: Label | null = null;
    private ammoLabel: Label | null = null;
    private messageLabel: Label | null = null;
    private nextLabel: Label | null = null;
    private ammoFill: UITransform | null = null;
    private goalFill: UITransform | null = null;
    private lastGold = '';
    private lastAmmo = '';
    private lastMessage = '';
    private lastNext = '';

    constructor(
        private readonly texts: HudTexts,
        private readonly economy: EconomySim,
        private readonly goal: GoalChainSim,
        private readonly ammoCap: number,
    ) {}

    public start(context: ModuleContext): void {
        const hud = createNode('Hud', context.ui, 0, 0);

        createBox('TopShadow', hud, toX(195), toY(56), toW(370), toH(82), PANEL_SHADOW);
        createBox('TopPanel', hud, toX(195), toY(52), toW(366), toH(78), PANEL);
        createBox('TopLine', hud, toX(195), toY(13), toW(366), toH(3), GOLD);
        createLabel('CommandTitle', hud, toX(195), toY(25), 'SALVAGE COMMAND', 18, TEXT_MUTED);

        createBox('GoldPanel', hud, toX(91), toY(54), toW(154), toH(42), PANEL_INNER);
        createBox('GoldAccent', hud, toX(17), toY(54), toW(5), toH(42), GOLD);
        createBox('CoinOuter', hud, toX(39), toY(54), toW(23), toW(23), GOLD_DARK);
        createBox('CoinInner', hud, toX(39), toY(54), toW(15), toW(15), GOLD);
        createLabel('GoldCaption', hud, toX(62), toY(43), 'SCRAP', 15, TEXT_MUTED);
        const gold = createLabel('GoldLabel', hud, toX(62), toY(59), '0', 30, TEXT_GOLD);
        gold.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
        gold.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.goldLabel = gold;

        createBox('AmmoPanel', hud, toX(299), toY(54), toW(154), toH(42), PANEL_INNER);
        createBox('AmmoAccent', hud, toX(373), toY(54), toW(5), toH(42), AMMO);
        createLabel('AmmoCaption', hud, toX(235), toY(43), 'DEFENSE AMMO', 15, TEXT_MUTED);
        this.ammoLabel = createLabel('AmmoLabel', hud, toX(299), toY(58), `0 / ${this.ammoCap}`, 25, TEXT_WHITE);
        createBox('AmmoTrack', hud, toX(299), toY(72), toW(128), toH(5), AMMO_DARK);
        const ammoFillNode = createBox('AmmoFill', hud, toX(235), toY(72), 0, toH(5), AMMO);
        this.ammoFill = ammoFillNode.getComponent(UITransform);
        this.ammoFill?.setAnchorPoint(0, 0.5);

        createBox('ObjectiveShadow', hud, toX(195), toY(132), toW(354), toH(76), PANEL_SHADOW);
        createBox('ObjectivePanel', hud, toX(195), toY(128), toW(350), toH(72), PANEL);
        createBox('ObjectiveLine', hud, toX(22), toY(128), toW(5), toH(72), GOLD);
        createLabel('ObjectiveCaption', hud, toX(44), toY(107), 'CURRENT OBJECTIVE', 16, TEXT_MUTED);
        this.messageLabel = createLabel('MessageLabel', hud, toX(195), toY(127), this.texts.guide, 27, TEXT_WHITE);
        this.nextLabel = createLabel('NextGoalLabel', hud, toX(195), toY(149), '', 21, TEXT_GOLD);
        createBox('GoalTrack', hud, toX(195), toY(159), toW(312), toH(6), GOLD_DARK);
        const goalFillNode = createBox('GoalFill', hud, toX(39), toY(159), 0, toH(6), GOLD);
        this.goalFill = goalFillNode.getComponent(UITransform);
        this.goalFill?.setAnchorPoint(0, 0.5);

        createBox('ThreatBadge', hud, toX(195), toY(190), toW(124), toH(24), PANEL);
        createBox('ThreatDot', hud, toX(145), toY(190), toW(8), toW(8), DANGER);
        createLabel('ThreatText', hud, toX(205), toY(190), 'THREAT ACTIVE', 15, TEXT_MUTED);
    }

    public tick(): void {
        const goldText = String(this.economy.gold);
        if (this.goldLabel && goldText !== this.lastGold) {
            this.goldLabel.string = goldText;
            this.lastGold = goldText;
        }

        const ammoText = `${this.economy.ammo} / ${this.ammoCap}`;
        if (this.ammoLabel && ammoText !== this.lastAmmo) {
            this.ammoLabel.string = ammoText;
            this.lastAmmo = ammoText;
        }
        this.ammoFill?.setContentSize(toW(128) * Math.min(this.economy.ammo / this.ammoCap, 1), toH(5));

        const messages: Record<GoalPhase, string> = {
            guide: this.texts.guide,
            manage: this.texts.manage,
            boom: this.texts.boom,
            end: this.texts.end,
        };
        const message = messages[this.goal.phase];
        if (this.messageLabel && message !== this.lastMessage) {
            this.messageLabel.string = message;
            this.lastMessage = message;
        }

        const next = this.goal.next();
        let nextText = '';
        if (next && (this.goal.phase === 'guide' || this.goal.phase === 'manage')) {
            const kindLabels = { hire: this.texts.hireLabel, unlock: this.texts.unlockLabel, vault: this.texts.vaultLabel };
            const label = kindLabels[next.kind];
            nextText = this.economy.canAfford(next.cost)
                ? `${this.texts.nextPrefix}${label} ${next.cost}`
                : `${this.texts.nextPrefix}${label} ${this.economy.gold}/${next.cost}`;
        }
        if (this.nextLabel && nextText !== this.lastNext) {
            this.nextLabel.string = nextText;
            this.lastNext = nextText;
        }
        const goalProgress = next ? Math.min(this.economy.gold / next.cost, 1) : 1;
        this.goalFill?.setContentSize(toW(312) * goalProgress, toH(6));
    }
}
