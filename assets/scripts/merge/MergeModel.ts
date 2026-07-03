import { MERGE_CONFIG } from './MergeConfig';
import { MergeHint, MergeItem, MergePhase } from './MergeTypes';

const CONFIG = MERGE_CONFIG;

export class MergeModel {
    public phase: MergePhase = MergePhase.Play;
    public merges: number = 0;
    public highestLevel: number = 0;
    public readonly cells: Array<MergeItem | null> = [];

    private nextId = 1;

    constructor() {
        for (const level of CONFIG.initialLevels) {
            if (level > 0) {
                this.cells.push({ id: this.nextId, level });
                this.nextId += 1;
                this.highestLevel = Math.max(this.highestLevel, level);
            } else {
                this.cells.push(null);
            }
        }
    }

    public tryMerge(fromCell: number, toCell: number): boolean {
        if (this.phase !== MergePhase.Play || fromCell === toCell) {
            return false;
        }

        const from = this.cells[fromCell];
        const to = this.cells[toCell];
        if (!from || !to || from.level !== to.level || to.level >= CONFIG.targetLevel) {
            return false;
        }

        this.cells[fromCell] = null;
        this.cells[toCell] = { id: this.nextId, level: to.level + 1 };
        this.nextId += 1;
        this.merges += 1;
        this.highestLevel = Math.max(this.highestLevel, to.level + 1);

        if (this.highestLevel >= CONFIG.targetLevel) {
            this.phase = MergePhase.End;
        }

        return true;
    }

    // Lowest-level pair first so the guided flow shows the whole merge chain
    // instead of jumping straight to the goal.
    public hint(): MergeHint | null {
        for (let level = 1; level <= CONFIG.targetLevel - 1; level += 1) {
            const indices: number[] = [];
            this.cells.forEach((item, index) => {
                if (item && item.level === level) {
                    indices.push(index);
                }
            });
            if (indices.length >= 2) {
                return { from: indices[0], to: indices[1] };
            }
        }
        return null;
    }
}
