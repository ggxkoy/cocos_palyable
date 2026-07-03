// 极简行为树引擎：纯逻辑、零 cc 依赖，供各模板 Model 驱动自主人物。
// 解压经营型：工人树「采集 → 搬运 → 入库」循环（小循环）；
// 战斗压力型：士兵树「索敌 → 接近 → 攻击」——同一套节点，换一棵树。
export enum BtStatus {
    Success = 'success',
    Failure = 'failure',
    Running = 'running',
}

export interface BtNode<TContext> {
    tick(context: TContext, deltaTime: number): BtStatus;
    reset(): void;
}

// 依次执行子节点；子节点失败则整体失败并复位，全部成功则成功。
export class Sequence<TContext> implements BtNode<TContext> {
    private index = 0;

    constructor(private readonly children: Array<BtNode<TContext>>) {}

    public tick(context: TContext, deltaTime: number): BtStatus {
        while (this.index < this.children.length) {
            const status = this.children[this.index].tick(context, deltaTime);
            if (status === BtStatus.Running) {
                return BtStatus.Running;
            }
            if (status === BtStatus.Failure) {
                this.reset();
                return BtStatus.Failure;
            }
            this.index += 1;
        }
        this.reset();
        return BtStatus.Success;
    }

    public reset(): void {
        this.index = 0;
        this.children.forEach(child => child.reset());
    }
}

// 依次尝试子节点；子节点成功则整体成功并复位，全部失败则失败。
export class Selector<TContext> implements BtNode<TContext> {
    private index = 0;

    constructor(private readonly children: Array<BtNode<TContext>>) {}

    public tick(context: TContext, deltaTime: number): BtStatus {
        while (this.index < this.children.length) {
            const status = this.children[this.index].tick(context, deltaTime);
            if (status === BtStatus.Running) {
                return BtStatus.Running;
            }
            if (status === BtStatus.Success) {
                this.reset();
                return BtStatus.Success;
            }
            this.index += 1;
        }
        this.reset();
        return BtStatus.Failure;
    }

    public reset(): void {
        this.index = 0;
        this.children.forEach(child => child.reset());
    }
}

export class Condition<TContext> implements BtNode<TContext> {
    constructor(private readonly predicate: (context: TContext) => boolean) {}

    public tick(context: TContext): BtStatus {
        return this.predicate(context) ? BtStatus.Success : BtStatus.Failure;
    }

    public reset(): void {
        // 无状态节点。
    }
}

export class Action<TContext> implements BtNode<TContext> {
    constructor(private readonly run: (context: TContext, deltaTime: number) => BtStatus) {}

    public tick(context: TContext, deltaTime: number): BtStatus {
        return this.run(context, deltaTime);
    }

    public reset(): void {
        // 动作自身的持续状态由 context 持有，便于整树复位后继续。
    }
}

// 无限循环子节点（子节点完成后复位重跑），始终返回 Running。
export class Repeat<TContext> implements BtNode<TContext> {
    constructor(private readonly child: BtNode<TContext>) {}

    public tick(context: TContext, deltaTime: number): BtStatus {
        const status = this.child.tick(context, deltaTime);
        if (status !== BtStatus.Running) {
            this.child.reset();
        }
        return BtStatus.Running;
    }

    public reset(): void {
        this.child.reset();
    }
}
