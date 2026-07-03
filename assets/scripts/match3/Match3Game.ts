import { _decorator, Component, Node, SpriteFrame } from 'cc';
import { download, notifyGameEnd } from '../common/PlayableSdk';
import { MATCH3_CONFIG } from './Match3Config';
import { Match3Model } from './Match3Model';
import { Match3Phase } from './Match3Types';
import { Match3View } from './Match3View';

const { ccclass, property } = _decorator;

@ccclass('Match3Game')
export class Match3Game extends Component {
    @property(SpriteFrame)
    public backgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public gemFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public handFrame: SpriteFrame | null = null;

    private readonly model: Match3Model = new Match3Model();
    private readonly view: Match3View = new Match3View();
    private ctaHandler: (() => void) | null = null;
    private selected: number | null = null;
    private elapsed = 0;
    private ended = false;

    protected onLoad(): void {
        this.view.build(this.node, {
            background: this.backgroundFrame,
            gem: this.gemFrame,
            button: this.buttonFrame,
            hand: this.handFrame,
        });
        this.view.refresh(this.model);
    }

    protected onEnable(): void {
        this.view.enableInput(cell => this.handleCellTap(cell));

        if (this.view.ctaButton) {
            this.ctaHandler = (): void => download(MATCH3_CONFIG.ctaUrl);
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

    private handleCellTap(cell: number): void {
        if (this.model.phase !== Match3Phase.Play) {
            return;
        }

        if (this.selected === null) {
            this.selected = cell;
            this.view.setSelected(cell);
            return;
        }

        if (this.selected === cell) {
            this.selected = null;
            this.view.setSelected(null);
            return;
        }

        if (!this.model.isAdjacent(this.selected, cell)) {
            this.selected = cell;
            this.view.setSelected(cell);
            return;
        }

        const result = this.model.swap(this.selected, cell);
        this.selected = null;
        this.view.setSelected(null);

        if (!result.valid) {
            return;
        }

        this.view.refresh(this.model);
        this.view.celebrate(result.cleared);
        this.checkEnd();
    }

    private checkEnd(): void {
        if (!this.ended && this.model.phase === Match3Phase.End) {
            this.ended = true;
            this.view.showEnd(this.model.won);
            notifyGameEnd();
        }
    }
}
