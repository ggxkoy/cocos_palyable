import { Color, Node } from 'cc';
import { createBox3D, setBoxColor } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { EconomySim } from '../economy/EconomySim';
import { GoalChainSim, GoalPurchase } from './GoalChainSim';

// 目标链视觉：当前环节的目标牌（地面亮牌）+ 常驻的大飞机锚点。
// 牌子颜色表达可负担状态；锚点开局锁定、打捞后变金。
const PAD = new Color(233, 185, 63, 255);
const PAD_DISABLED = new Color(140, 120, 90, 255);
const VAULT_LOCKED = new Color(88, 92, 100, 255);
const VAULT_OPEN = new Color(240, 186, 60, 255);
const LOCK = new Color(40, 38, 34, 255);

export class GoalChainModule implements PlayableModule {
    private pad: Node | null = null;
    private padAffordable = true;
    private vaultBody: Node | null = null;
    private vaultLock: Node | null = null;
    private shownPurchaseId: string | null = null;

    constructor(
        private readonly goal: GoalChainSim,
        private readonly economy: EconomySim,
        private readonly vaultPos: { readonly x: number; readonly z: number },
    ) {}

    public start(context: ModuleContext): void {
        this.pad = createBox3D('GoalPad', context.world, 0, 0.04, 0, 1.7, 0.1, 1.7, PAD);
        this.pad.active = false;

        // 长期锚点：大飞机残骸从第一帧就横在泥潭里。
        const vault = createBox3D('PlaneWreck', context.world, this.vaultPos.x, 0.5, this.vaultPos.z, 3.4, 1.0, 1.6, VAULT_LOCKED);
        createBox3D('Wing', vault, 0, 0.1, 0, 1.1, 0.25, 3.6, VAULT_LOCKED);
        const lock = createBox3D('WreckLock', vault, 0, 0.9, 0, 0.4, 0.55, 0.4, LOCK);
        this.vaultBody = vault;
        this.vaultLock = lock;
    }

    public tick(): void {
        const next = this.goal.next();
        if (this.pad) {
            const showPad = !!next && next.kind !== 'vault' && (this.goal.phase === 'guide' || this.goal.phase === 'manage');
            this.pad.active = showPad;
            if (showPad && next) {
                if (this.shownPurchaseId !== next.id) {
                    this.shownPurchaseId = next.id;
                    this.pad.setPosition(next.x, 0.04, next.z);
                }
                this.syncPadColor(next);
            }
        }

        if (this.vaultLock) {
            this.vaultLock.active = !this.goal.vaultOpened;
        }
        if (this.vaultBody && this.goal.vaultOpened && !this.vaultBody.name.endsWith('-open')) {
            this.vaultBody.name = 'PlaneWreck-open';
            setBoxColor(this.vaultBody, VAULT_OPEN);
        }
    }

    private syncPadColor(next: GoalPurchase): void {
        const affordable = this.economy.canAfford(next.cost);
        if (affordable !== this.padAffordable && this.pad) {
            this.padAffordable = affordable;
            setBoxColor(this.pad, affordable ? PAD : PAD_DISABLED);
        }
    }
}
