import { Camera, Node } from 'cc';
import { EventBus } from './EventBus';

// 模块契约：一个 playable = 一份配置 + 一张模块清单。
// 规则在各模块的 *Sim.ts（纯逻辑）里，视觉模块只读状态、听总线。
export interface ModuleContext {
    readonly world: Node;
    readonly ui: Node;
    readonly bus: EventBus;
    camera3d: Camera | null;
}

export interface PlayableModule {
    start(context: ModuleContext): void;
    tick?(deltaTime: number, time: number): void;
    dispose?(): void;
}
