declare module 'cc' {
  export namespace _decorator {
    export function ccclass(name: string): ClassDecorator;
    export function property(type?: unknown): PropertyDecorator;
  }

  export class Component {
    protected onLoad?(): void;
    protected onEnable?(): void;
    protected start?(): void;
    protected update?(deltaTime: number): void;
    protected onDisable?(): void;
  }

  export class Label {
    public string: string;
  }

  export class Node {
    public static readonly EventType: {
      readonly TOUCH_END: string;
    };

    public on(event: string, callback: () => void, target?: unknown): void;
    public off(event: string, callback?: () => void, target?: unknown): void;
  }
}
