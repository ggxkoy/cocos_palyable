// 模块间唯一的通信通道（纯逻辑，可在 node 冒烟中直接使用）。
// 约定事件命名：goal:*（目标链）、fx:*（表现层特效）、economy:*。
export type BusHandler = (payload?: unknown) => void;

export class EventBus {
    private readonly handlers = new Map<string, BusHandler[]>();

    public on(event: string, handler: BusHandler): void {
        const list = this.handlers.get(event) ?? [];
        list.push(handler);
        this.handlers.set(event, list);
    }

    public off(event: string, handler: BusHandler): void {
        const list = this.handlers.get(event);
        if (!list) {
            return;
        }
        const index = list.indexOf(handler);
        if (index >= 0) {
            list.splice(index, 1);
        }
    }

    public emit(event: string, payload?: unknown): void {
        const list = this.handlers.get(event);
        if (!list) {
            return;
        }
        for (const handler of [...list]) {
            handler(payload);
        }
    }
}
