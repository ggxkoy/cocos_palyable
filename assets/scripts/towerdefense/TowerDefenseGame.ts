import { _decorator, Component, Node, SpriteFrame } from 'cc';
import { download, notifyGameEnd } from '../common/PlayableSdk';
import { TOWER_DEFENSE_CONFIG } from './TowerDefenseConfig';
import { TowerDefenseModel } from './TowerDefenseModel';
import { PlayableState } from './TowerDefenseTypes';
import { TowerDefenseView } from './TowerDefenseView';

const { ccclass, property } = _decorator;

@ccclass('TowerDefenseGame')
export class TowerDefenseGame extends Component {
    @property(SpriteFrame)
    public backgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public slotFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public towerFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public enemyFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public handFrame: SpriteFrame | null = null;

    private readonly model: TowerDefenseModel = new TowerDefenseModel();
    private readonly view: TowerDefenseView = new TowerDefenseView();
    private readonly slotHandlers: Array<{ node: Node; handler: () => void }> = [];
    private ctaHandler: (() => void) | null = null;
    private elapsed = 0;
    private ended = false;

    protected onLoad(): void {
        this.view.build(this.node, {
            background: this.backgroundFrame,
            slot: this.slotFrame,
            tower: this.towerFrame,
            enemy: this.enemyFrame,
            button: this.buttonFrame,
            hand: this.handFrame,
        });
    }

    protected onEnable(): void {
        this.slotHandlers.length = 0;
        for (const slot of this.view.slots) {
            const handler = (): void => this.handleSlotTap(slot.id);
            this.slotHandlers.push({ node: slot.node, handler });
            slot.node.on(Node.EventType.TOUCH_END, handler, this);
        }

        if (this.view.ctaButton) {
            this.ctaHandler = (): void => download(TOWER_DEFENSE_CONFIG.ctaUrl);
            this.view.ctaButton.on(Node.EventType.TOUCH_END, this.ctaHandler, this);
        }
    }

    protected start(): void {
        this.model.start();
    }

    protected update(deltaTime: number): void {
        this.elapsed += deltaTime;
        this.model.update(deltaTime);

        if (!this.ended && (this.model.state === PlayableState.Won || this.model.state === PlayableState.Failed)) {
            this.ended = true;
            this.view.showEnd(this.model.state === PlayableState.Won);
            notifyGameEnd();
        }

        this.view.tick(deltaTime, this.elapsed, this.model);
    }

    protected onDisable(): void {
        for (const entry of this.slotHandlers) {
            entry.node.off(Node.EventType.TOUCH_END, entry.handler, this);
        }
        this.slotHandlers.length = 0;

        if (this.view.ctaButton && this.ctaHandler) {
            this.view.ctaButton.off(Node.EventType.TOUCH_END, this.ctaHandler, this);
            this.ctaHandler = null;
        }
    }

    private handleSlotTap(slotId: number): void {
        if (this.model.buildTower(slotId)) {
            this.view.showTowerBuilt(slotId);
        }
    }
}
