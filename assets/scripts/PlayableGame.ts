import { _decorator, Component, Label, Node } from 'cc';
import { PlayableModel } from './PlayableModel';
import { PlayableState } from './GameTypes';

const { ccclass, property } = _decorator;

@ccclass('PlayableGame')
export class PlayableGame extends Component {
    @property(Label)
    private readonly coinLabel: Label | null = null;

    @property(Label)
    private readonly healthLabel: Label | null = null;

    @property(Label)
    private readonly stateLabel: Label | null = null;

    @property([Node])
    private readonly buildSlots: Node[] = [];

    private readonly model: PlayableModel = new PlayableModel();
    private readonly slotHandlers: Array<() => void> = [];

    protected onLoad(): void {
        if (!this.coinLabel || !this.healthLabel || !this.stateLabel) {
            throw new Error('PlayableGame: HUD labels are required');
        }

        if (this.buildSlots.length === 0) {
            throw new Error('PlayableGame: at least one build slot is required');
        }
    }

    protected onEnable(): void {
        this.slotHandlers.length = 0;
        this.buildSlots.forEach((slot, index) => {
            const handler = (): void => this.handleBuildSlot(index + 1);
            this.slotHandlers.push(handler);
            slot.on(Node.EventType.TOUCH_END, handler, this);
        });
    }

    protected start(): void {
        this.model.start();
        this.refreshHud();
    }

    protected update(deltaTime: number): void {
        this.model.update(deltaTime);
        this.refreshHud();
    }

    protected onDisable(): void {
        this.buildSlots.forEach((slot, index) => {
            const handler = this.slotHandlers[index];
            if (handler) {
                slot.off(Node.EventType.TOUCH_END, handler, this);
            }
        });
        this.slotHandlers.length = 0;
    }

    private handleBuildSlot(slotId: number): void {
        this.model.buildTower(slotId);
        this.refreshHud();
    }

    private refreshHud(): void {
        this.coinLabel!.string = `Coins ${this.model.coins}`;
        this.healthLabel!.string = `Base ${this.model.baseHealth}`;
        this.stateLabel!.string = this.getStateText();
    }

    private getStateText(): string {
        if (this.model.state === PlayableState.Won) {
            return 'Victory';
        }

        if (this.model.state === PlayableState.Failed) {
            return 'Try Again';
        }

        return 'Build Towers';
    }
}
