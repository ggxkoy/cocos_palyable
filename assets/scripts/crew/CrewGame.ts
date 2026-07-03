import { _decorator, Component, Node, SpriteFrame } from 'cc';
import { download, notifyGameEnd } from '../common/PlayableSdk';
import { CREW_CONFIG } from './CrewConfig';
import { CrewModel } from './CrewModel';
import { CrewPhase } from './CrewTypes';
import { CrewView } from './CrewView';

const { ccclass, property } = _decorator;

@ccclass('CrewGame')
export class CrewGame extends Component {
    @property(SpriteFrame)
    public backgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public veinFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public depotFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public workerFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public handFrame: SpriteFrame | null = null;

    private readonly model: CrewModel = new CrewModel();
    private readonly view: CrewView = new CrewView();
    private readonly padHandlers: Array<{ node: Node; handler: () => void }> = [];
    private ctaHandler: (() => void) | null = null;
    private elapsed = 0;
    private ended = false;

    protected onLoad(): void {
        this.view.build(this.node, {
            background: this.backgroundFrame,
            vein: this.veinFrame,
            depot: this.depotFrame,
            worker: this.workerFrame,
            button: this.buttonFrame,
            hand: this.handFrame,
        });
    }

    protected onEnable(): void {
        this.padHandlers.length = 0;
        for (const pad of this.view.pads) {
            const handler = (): void => this.handlePadTap(pad.purchaseId);
            this.padHandlers.push({ node: pad.node, handler });
            pad.node.on(Node.EventType.TOUCH_END, handler, this);
        }

        if (this.view.ctaButton) {
            this.ctaHandler = (): void => download(CREW_CONFIG.ctaUrl);
            this.view.ctaButton.on(Node.EventType.TOUCH_END, this.ctaHandler, this);
        }
    }

    protected update(deltaTime: number): void {
        this.elapsed += deltaTime;
        this.model.update(deltaTime);

        if (!this.ended && this.model.phase === CrewPhase.End) {
            this.ended = true;
            notifyGameEnd();
        }

        this.view.tick(deltaTime, this.elapsed, this.model);
    }

    protected onDisable(): void {
        for (const entry of this.padHandlers) {
            entry.node.off(Node.EventType.TOUCH_END, entry.handler, this);
        }
        this.padHandlers.length = 0;

        if (this.view.ctaButton && this.ctaHandler) {
            this.view.ctaButton.off(Node.EventType.TOUCH_END, this.ctaHandler, this);
            this.ctaHandler = null;
        }
    }

    private handlePadTap(purchaseId: string): void {
        if (this.model.tapPurchase(purchaseId)) {
            this.view.celebratePurchase(purchaseId);
        }
    }
}
