import { Color, Node, Prefab, SkeletalAnimation, instantiate } from 'cc';
import { FbxAnimator, bakedClipOf } from '../../common3d/FbxAnimator';
import { fitModelHeight } from '../../common3d/ModelFit';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { WorkerCrewSim } from './WorkerCrewSim';

// 雇员视觉：工兵模型（09 的蓝兵，单条 Take 001 按帧号切段）+ 背上废料堆。
// 帧段（见 09_炮塔小兵/TW-…txt）：移动不开枪 280-298、砍树 310-324（当拉绳作业）、
// 造墙 330-343（当入库结算）、空手待机 360-390。
const BODY = new Color(224, 140, 60, 255);
const HEAD = new Color(240, 205, 165, 255);
const CARRY = new Color(255, 200, 80, 255);

const WORKER_SEGMENTS = {
    move: { from: 280, to: 298 },
    work: { from: 310, to: 324 },
    deposit: { from: 330, to: 343 },
    idle: { from: 360, to: 390 },
} as const;

interface WorkerView {
    readonly root: Node;
    readonly model: Node | null;
    readonly animator: FbxAnimator | null;
    readonly bars: Node[];
    lastX: number;
    lastZ: number;
}

export class WorkerCrewModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private readonly views = new Map<number, WorkerView>();

    constructor(
        private readonly workers: WorkerCrewSim,
        private readonly capacity: number,
        private readonly workerPrefab: Prefab | null = null,
        private readonly fitHeight: number = 1.55,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;
    }

    public tick(deltaTime: number): void {
        if (!this.context) {
            return;
        }
        for (const worker of this.workers.workers) {
            let view = this.views.get(worker.id);
            if (!view) {
                view = this.createView(worker.id, worker.x, worker.z);
                this.views.set(worker.id, view);
            }

            // 朝移动方向转身；用位移判定「在走」（rally 站定时别播走路）。
            const dx = worker.x - view.lastX;
            const dz = worker.z - view.lastZ;
            const moved = Math.hypot(dx, dz) > 0.002;
            if (view.model && moved) {
                view.model.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
            }
            view.lastX = worker.x;
            view.lastZ = worker.z;
            view.root.setPosition(worker.x, 0, worker.z);

            if (view.animator) {
                const state = moved ? 'move'
                    : worker.task === 'work' ? 'work'
                    : worker.task === 'deposit' ? 'deposit'
                    : 'idle';
                view.animator.set(state);
                view.animator.tick(deltaTime);
            }

            view.bars.forEach((bar, index) => {
                bar.active = worker.carried.length > index;
            });
        }
    }

    private createView(id: number, x: number, z: number): WorkerView {
        const root = new Node(`Worker${id}`);
        this.context!.world.addChild(root);
        root.setPosition(x, 0, z);

        let model: Node | null = null;
        let animator: FbxAnimator | null = null;
        if (this.workerPrefab) {
            model = instantiate(this.workerPrefab);
            model.name = 'WorkerModel';
            root.addChild(model);
            fitModelHeight(model, this.fitHeight);
            const anim = model.getComponentInChildren(SkeletalAnimation);
            animator = new FbxAnimator(anim);
            const baked = bakedClipOf(anim);
            animator.define('move', { clip: baked, ...WORKER_SEGMENTS.move });
            animator.define('work', { clip: baked, ...WORKER_SEGMENTS.work });
            animator.define('deposit', { clip: baked, ...WORKER_SEGMENTS.deposit });
            animator.define('idle', { clip: baked, ...WORKER_SEGMENTS.idle });
            animator.set('idle');
        } else {
            createBox3D('Body', root, 0, 0.38, 0, 0.42, 0.76, 0.36, BODY);
            createBox3D('Head', root, 0, 0.95, 0, 0.3, 0.3, 0.3, HEAD);
        }

        const bars: Node[] = [];
        for (let i = 0; i < this.capacity; i += 1) {
            const bar = createBox3D(`Carry${i}`, root, 0, 1.22 + i * 0.18, 0, 0.36, 0.12, 0.26, CARRY);
            bar.active = false;
            bars.push(bar);
        }
        return { root, model, animator, bars, lastX: x, lastZ: z };
    }
}
