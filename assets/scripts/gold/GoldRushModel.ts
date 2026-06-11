import { GoldCrate, GoldRushPhase, GoldRushSnapshot } from './GoldRushTypes';

export class GoldRushModel {
    public phase: GoldRushPhase = GoldRushPhase.Collect;
    public gold: number = 0;
    public upgradeLevel: number = 0;
    public battleProgress: number = 0;
    public readonly crates: GoldCrate[] = [
        { id: 1, collected: false },
        { id: 2, collected: false },
        { id: 3, collected: false },
    ];

    public collectCrate(crateId: number): boolean {
        if (this.phase !== GoldRushPhase.Collect) {
            return false;
        }

        const crate = this.crates.find(item => item.id === crateId);
        if (!crate || crate.collected) {
            return false;
        }

        crate.collected = true;
        this.gold += 25;

        if (this.crates.every(item => item.collected)) {
            this.phase = GoldRushPhase.Upgrade;
        }

        return true;
    }

    public upgradeBase(): boolean {
        if (this.phase !== GoldRushPhase.Upgrade || this.gold < 75) {
            return false;
        }

        this.gold -= 75;
        this.upgradeLevel = 1;
        this.phase = GoldRushPhase.Battle;
        return true;
    }

    public update(deltaTime: number): void {
        if (this.phase !== GoldRushPhase.Battle) {
            return;
        }

        this.battleProgress = Math.min(1, this.battleProgress + deltaTime * 0.28);
        if (this.battleProgress >= 1) {
            this.phase = GoldRushPhase.End;
        }
    }

    public getSnapshot(): GoldRushSnapshot {
        return {
            phase: this.phase,
            gold: this.gold,
            upgradeLevel: this.upgradeLevel,
            battleProgress: this.battleProgress,
        };
    }
}
