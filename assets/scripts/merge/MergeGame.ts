import { _decorator, Component, Node, SpriteFrame } from 'cc';
import { download, notifyGameEnd } from '../common/PlayableSdk';
import { MERGE_CONFIG } from './MergeConfig';
import { MergeModel } from './MergeModel';
import { MergePhase } from './MergeTypes';
import { MergeView } from './MergeView';

const { ccclass, property } = _decorator;

@ccclass('MergeGame')
export class MergeGame extends Component {
    @property(SpriteFrame)
    public backgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public cellFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public itemFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public handFrame: SpriteFrame | null = null;

    private readonly model: MergeModel = new MergeModel();
    private readonly view: MergeView = new MergeView();
    private ctaHandler: (() => void) | null = null;
    private elapsed = 0;
    private ended = false;

    protected onLoad(): void {
        this.view.build(this.node, {
            background: this.backgroundFrame,
            cell: this.cellFrame,
            item: this.itemFrame,
            button: this.buttonFrame,
            hand: this.handFrame,
        });
        this.view.refresh(this.model);
    }

    protected onEnable(): void {
        this.view.enableInput((from, to) => this.handleMerge(from, to));

        if (this.view.ctaButton) {
            this.ctaHandler = (): void => download(MERGE_CONFIG.ctaUrl);
            this.view.ctaButton.on(Node.EventType.TOUCH_END, this.ctaHandler, this);
        }
    }

    protected update(deltaTime: number): void {
        this.elapsed += deltaTime;
        this.view.tick(deltaTime, this.elapsed, this.model);
    }

    protected onDisable(): void {
        this.view.disableInput();

        if (this.view.ctaButton && this.ctaHandler) {
            this.view.ctaButton.off(Node.EventType.TOUCH_END, this.ctaHandler, this);
            this.ctaHandler = null;
        }
    }

    private handleMerge(from: number, to: number): void {
        if (!this.model.tryMerge(from, to)) {
            return;
        }

        this.view.burstAt(to);
        this.view.refresh(this.model);

        if (!this.ended && this.model.phase === MergePhase.End) {
            this.ended = true;
            this.view.showEnd();
            notifyGameEnd();
        }
    }
}
