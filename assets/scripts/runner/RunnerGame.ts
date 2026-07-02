import { _decorator, Component, Node, SpriteFrame } from 'cc';
import { download, notifyGameEnd } from '../common/PlayableSdk';
import { RUNNER_CONFIG } from './RunnerConfig';
import { RunnerModel } from './RunnerModel';
import { RunnerPhase } from './RunnerTypes';
import { RunnerView } from './RunnerView';

const { ccclass, property } = _decorator;

@ccclass('RunnerGame')
export class RunnerGame extends Component {
    @property(SpriteFrame)
    public backgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public playerFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public obstacleFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public coinFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public handFrame: SpriteFrame | null = null;

    private readonly model: RunnerModel = new RunnerModel();
    private readonly view: RunnerView = new RunnerView();
    private ctaHandler: (() => void) | null = null;
    private elapsed = 0;
    private ended = false;

    protected onLoad(): void {
        this.view.build(this.node, {
            background: this.backgroundFrame,
            player: this.playerFrame,
            obstacle: this.obstacleFrame,
            coin: this.coinFrame,
            button: this.buttonFrame,
            hand: this.handFrame,
        });
    }

    protected onEnable(): void {
        this.view.enableInput(direction => this.handleTap(direction));

        if (this.view.ctaButton) {
            this.ctaHandler = (): void => download(RUNNER_CONFIG.ctaUrl);
            this.view.ctaButton.on(Node.EventType.TOUCH_END, this.ctaHandler, this);
        }
    }

    protected update(deltaTime: number): void {
        this.elapsed += deltaTime;
        this.model.update(deltaTime);

        if (!this.ended && this.model.phase !== RunnerPhase.Running) {
            this.ended = true;
            this.view.showEnd(this.model.phase === RunnerPhase.Won);
            notifyGameEnd();
        }

        this.view.tick(deltaTime, this.elapsed, this.model);
    }

    protected onDisable(): void {
        this.view.disableInput();

        if (this.view.ctaButton && this.ctaHandler) {
            this.view.ctaButton.off(Node.EventType.TOUCH_END, this.ctaHandler, this);
            this.ctaHandler = null;
        }
    }

    private handleTap(direction: -1 | 1): void {
        this.view.dismissHint();
        this.model.switchLane(direction);
    }
}
