import { Node } from 'cc';
import { buildEndCard, EndCardHandles } from '../../common/EndCard';
import { download, notifyGameEnd } from '../../common/PlayableSdk';
import { ModuleContext, PlayableModule } from '../../framework/Module';

// 结算卡模块：监听 goal:end 展示 2D 结算卡与 CTA。
export interface EndCardTexts {
    readonly winTitle: string;
    readonly winSubtitle: string;
    readonly cta: string;
}

export class EndCardModule implements PlayableModule {
    private card: EndCardHandles | null = null;
    private readonly ctaHandler = (): void => download(this.ctaUrl);

    constructor(
        private readonly texts: EndCardTexts,
        private readonly ctaUrl: string,
    ) {}

    public start(context: ModuleContext): void {
        this.card = buildEndCard(context.ui, {
            title: this.texts.winTitle,
            subtitle: this.texts.winSubtitle,
            ctaText: this.texts.cta,
            buttonFrame: null,
        });
        this.card.ctaButton.on(Node.EventType.TOUCH_END, this.ctaHandler, this);

        context.bus.on('goal:end', () => {
            if (this.card) {
                this.card.root.active = true;
            }
            notifyGameEnd();
        });
    }

    public dispose(): void {
        this.card?.ctaButton.off(Node.EventType.TOUCH_END, this.ctaHandler, this);
    }
}
