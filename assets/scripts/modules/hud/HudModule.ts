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

const PANEL = new Color(12, 17, 18, 184);
const GOLD = new Color(255, 216, 95, 255);
const TEXT_GOLD = new Color(255, 245, 196, 255);
const TEXT_WHITE = new Color(255, 255, 255, 255);

export class HudModule implements PlayableModule {
    private goldLabel: Label | null = null;
    private ammoLabel: Label | null = null;
    private messageLabel: Label | null = null;
    private nextLabel: Label | null = null;
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

        createBox('GoldPanel', hud, toX(97), toY(47), toW(150), toH(46), PANEL);
        createBox('CoinIcon', hud, toX(48), toY(47), toW(24), toW(24), GOLD);
        const gold = createLabel('GoldLabel', hud, toX(80), toY(48), '0', 40, TEXT_GOLD);
        gold.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
        gold.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.goldLabel = gold;

        createBox('AmmoPanel', hud, toX(293), toY(47), toW(150), toH(46), PANEL);
        this.ammoLabel = createLabel('AmmoLabel', hud, toX(293), toY(48), `${this.texts.ammoPrefix}0/${this.ammoCap}`, 28, TEXT_WHITE);

        this.messageLabel = createLabel('MessageLabel', hud, toX(195), toY(112), this.texts.guide, 38, TEXT_WHITE);
        this.nextLabel = createLabel('NextGoalLabel', hud, toX(195), toY(152), '', 30, TEXT_GOLD);
    }

    public tick(): void {
        const goldText = String(this.economy.gold);
        if (this.goldLabel && goldText !== this.lastGold) {
            this.goldLabel.string = goldText;
            this.lastGold = goldText;
        }

        const ammoText = `${this.texts.ammoPrefix}${this.economy.ammo}/${this.ammoCap}`;
        if (this.ammoLabel && ammoText !== this.lastAmmo) {
            this.ammoLabel.string = ammoText;
            this.lastAmmo = ammoText;
        }

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
    }
}
