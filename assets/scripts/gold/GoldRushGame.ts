import { _decorator, Component, Node, SpriteFrame } from 'cc';
import { GoldRushModel } from './GoldRushModel';
import { GoldRushPhase } from './GoldRushTypes';
import { GoldRushView } from './GoldRushView';
import { download, notifyGameEnd } from './PlayableSdk';

const { ccclass, property } = _decorator;

@ccclass('GoldRushGame')
export class GoldRushGame extends Component {
    @property(SpriteFrame)
    public backgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public crateFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public baseFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public soldierFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public enemyFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public coinFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public handFrame: SpriteFrame | null = null;

    private readonly model: GoldRushModel = new GoldRushModel();
    private readonly view: GoldRushView = new GoldRushView();
    private readonly crateHandlers: Array<{ node: Node; handler: () => void }> = [];
    private upgradeHandler: (() => void) | null = null;
    private ctaHandler: (() => void) | null = null;
    private elapsed = 0;
    private lastPhase: GoldRushPhase = GoldRushPhase.Collect;

    protected onLoad(): void {
        this.view.build(this.node, {
            background: this.backgroundFrame,
            crate: this.crateFrame,
            base: this.baseFrame,
            soldier: this.soldierFrame,
            enemy: this.enemyFrame,
            coin: this.coinFrame,
            button: this.buttonFrame,
            hand: this.handFrame,
        });
    }

    protected onEnable(): void {
        this.crateHandlers.length = 0;
        for (const crate of this.view.crates) {
            const handler = (): void => this.handleCrateTap(crate.id);
            this.crateHandlers.push({ node: crate.node, handler });
            crate.node.on(Node.EventType.TOUCH_END, handler, this);
        }

        if (this.view.upgradeButton) {
            this.upgradeHandler = (): void => this.handleUpgradeTap();
            this.view.upgradeButton.on(Node.EventType.TOUCH_END, this.upgradeHandler, this);
        }

        if (this.view.ctaButton) {
            this.ctaHandler = (): void => download();
            this.view.ctaButton.on(Node.EventType.TOUCH_END, this.ctaHandler, this);
        }
    }

    protected start(): void {
        this.view.applyPhase(this.model.getSnapshot());
    }

    protected update(deltaTime: number): void {
        this.elapsed += deltaTime;
        this.model.update(deltaTime);

        const snapshot = this.model.getSnapshot();
        if (snapshot.phase !== this.lastPhase) {
            this.handlePhaseChange(snapshot.phase);
        }
        this.view.tick(deltaTime, this.elapsed, snapshot);
    }

    protected onDisable(): void {
        for (const entry of this.crateHandlers) {
            entry.node.off(Node.EventType.TOUCH_END, entry.handler, this);
        }
        this.crateHandlers.length = 0;

        if (this.view.upgradeButton && this.upgradeHandler) {
            this.view.upgradeButton.off(Node.EventType.TOUCH_END, this.upgradeHandler, this);
            this.upgradeHandler = null;
        }

        if (this.view.ctaButton && this.ctaHandler) {
            this.view.ctaButton.off(Node.EventType.TOUCH_END, this.ctaHandler, this);
            this.ctaHandler = null;
        }
    }

    private handleCrateTap(crateId: number): void {
        if (this.model.collectCrate(crateId)) {
            this.view.collectCrate(crateId);
        }
    }

    private handleUpgradeTap(): void {
        if (this.model.upgradeBase()) {
            this.view.showUpgrade();
        }
    }

    private handlePhaseChange(phase: GoldRushPhase): void {
        this.lastPhase = phase;
        if (phase === GoldRushPhase.End) {
            this.view.showVictory();
            notifyGameEnd();
        }
        this.view.applyPhase(this.model.getSnapshot());
    }
}
