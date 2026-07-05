import { Color, Node } from 'cc';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { WorkerCrewSim } from './WorkerCrewSim';

// 雇员视觉：橙衣工兵 + 背上金锭堆。
const BODY = new Color(224, 140, 60, 255);
const HEAD = new Color(240, 205, 165, 255);
const CARRY = new Color(255, 200, 80, 255);

interface WorkerView {
    readonly root: Node;
    readonly bars: Node[];
}

export class WorkerCrewModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private readonly views = new Map<number, WorkerView>();

    constructor(
        private readonly workers: WorkerCrewSim,
        private readonly capacity: number,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;
    }

    public tick(): void {
        if (!this.context) {
            return;
        }
        for (const worker of this.workers.workers) {
            let view = this.views.get(worker.id);
            if (!view) {
                const root = new Node(`Worker${worker.id}`);
                this.context.world.addChild(root);
                createBox3D('Body', root, 0, 0.38, 0, 0.42, 0.76, 0.36, BODY);
                createBox3D('Head', root, 0, 0.95, 0, 0.3, 0.3, 0.3, HEAD);
                const bars: Node[] = [];
                for (let i = 0; i < this.capacity; i += 1) {
                    const bar = createBox3D(`Carry${i}`, root, 0, 1.22 + i * 0.18, 0, 0.36, 0.12, 0.26, CARRY);
                    bar.active = false;
                    bars.push(bar);
                }
                view = { root, bars };
                this.views.set(worker.id, view);
            }
            view.root.setPosition(worker.x, 0, worker.z);
            view.bars.forEach((bar, index) => {
                bar.active = worker.carrying > index;
            });
        }
    }
}
