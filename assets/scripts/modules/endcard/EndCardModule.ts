import { Color, Node, UITransform } from 'cc';
import { buildEndCard, EndCardHandles } from '../../common/EndCard';
import { toH, toW, toX, toY } from '../../common/Layout';
import { createBox, createLabel } from '../../common/PlaceholderFactory';
import { download, notifyGameEnd } from '../../common/PlayableSdk';
import { ModuleContext, PlayableModule } from '../../framework/Module';

// 结算卡模块：
// - goal:end（胜利）→ 胜利文案 + CTA；
// - goal:fail（围墙被击破）→ 失败文案 + RETRY（还有重试次数时）+ CTA；
//   点 RETRY 调用注入的复活回调（goal.revive），成功则收起卡片继续玩。
export interface EndCardTexts {
    readonly winTitle: string;
    readonly winSubtitle: string;
    readonly failTitle: string;
    readonly failSubtitle: string;
    readonly retryLabel: string;
    readonly cta: string;
}

const RETRY_BG = new Color(88, 156, 96, 255);
const RETRY_TEXT = new Color(240, 250, 240, 255);

export class EndCardModule implements PlayableModule {
    private card: EndCardHandles | null = null;
    private retryButton: Node | null = null;
    private readonly ctaHandler = (): void => download(this.ctaUrl);
    private readonly retryHandler = (): void => {
        if (this.onRetry?.()) {
            if (this.card) {
                this.card.root.active = false;
            }
        }
    };

    constructor(
        private readonly texts: EndCardTexts,
        private readonly ctaUrl: string,
        private readonly onRetry: (() => boolean) | null = null,
        private readonly canRetry: (() => boolean) | null = null,
    ) {}

    public start(context: ModuleContext): void {
        this.card = buildEndCard(context.ui, {
            title: this.texts.winTitle,
            subtitle: this.texts.winSubtitle,
            ctaText: this.texts.cta,
            buttonFrame: null,
        });
        this.card.ctaButton.on(Node.EventType.TOUCH_END, this.ctaHandler, this);

        // RETRY 按钮（失败卡专用，胜利卡隐藏）。
        const retry = new Node('RetryButton');
        this.card.root.addChild(retry);
        retry.setPosition(toX(195), toY(640));
        retry.addComponent(UITransform).setContentSize(toW(262), toH(64));
        createBox('RetryBg', retry, 0, 0, toW(262), toH(64), RETRY_BG);
        createLabel('RetryLabel', retry, 0, 0, this.texts.retryLabel, 42, RETRY_TEXT);
        retry.on(Node.EventType.TOUCH_END, this.retryHandler, this);
        retry.active = false;
        this.retryButton = retry;

        context.bus.on('goal:end', () => {
            if (this.card) {
                this.card.title.string = this.texts.winTitle;
                this.card.subtitle.string = this.texts.winSubtitle;
                this.card.root.active = true;
            }
            if (this.retryButton) {
                this.retryButton.active = false;
            }
            notifyGameEnd();
        });

        context.bus.on('goal:fail', () => {
            const retryable = (this.onRetry !== null) && (this.canRetry?.() ?? true);
            if (this.card) {
                this.card.title.string = this.texts.failTitle;
                this.card.subtitle.string = this.texts.failSubtitle;
                this.card.root.active = true;
            }
            if (this.retryButton) {
                this.retryButton.active = retryable;
            }
            if (!retryable) {
                notifyGameEnd();
            }
        });
    }

    public dispose(): void {
        this.card?.ctaButton.off(Node.EventType.TOUCH_END, this.ctaHandler, this);
        this.retryButton?.off(Node.EventType.TOUCH_END, this.retryHandler, this);
    }
}
