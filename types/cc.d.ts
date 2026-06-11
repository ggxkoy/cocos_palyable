declare module 'cc' {
  export namespace _decorator {
    export function ccclass(name: string): ClassDecorator;
    export function property(type?: unknown): PropertyDecorator;
  }

  export class Color {
    constructor(r?: number, g?: number, b?: number, a?: number);
    public r: number;
    public g: number;
    public b: number;
    public a: number;
    public clone(): Color;
  }

  export class Vec3 {
    constructor(x?: number, y?: number, z?: number);
    public x: number;
    public y: number;
    public z: number;
  }

  export class Size {
    constructor(width?: number, height?: number);
    public width: number;
    public height: number;
  }

  export class Component {
    public readonly node: Node;
    public enabled: boolean;
    public getComponent<T extends Component>(classConstructor: new (...args: never[]) => T): T | null;
    protected onLoad?(): void;
    protected onEnable?(): void;
    protected start?(): void;
    protected update?(deltaTime: number): void;
    protected onDisable?(): void;
  }

  export class Node {
    public static readonly EventType: {
      readonly TOUCH_START: string;
      readonly TOUCH_END: string;
    };

    constructor(name?: string);
    public name: string;
    public active: boolean;
    public layer: number;
    public angle: number;
    public parent: Node | null;
    public readonly children: Node[];
    public addChild(child: Node): void;
    public removeFromParent(): void;
    public destroy(): boolean;
    public setPosition(x: number, y: number, z?: number): void;
    public getPosition(out?: Vec3): Vec3;
    public setScale(x: number, y: number, z?: number): void;
    public getChildByName(name: string): Node | null;
    public getChildByPath(path: string): Node | null;
    public addComponent<T extends Component>(classConstructor: new (...args: never[]) => T): T;
    public getComponent<T extends Component>(classConstructor: new (...args: never[]) => T): T | null;
    public on(event: string, callback: (...args: never[]) => void, target?: unknown): void;
    public off(event: string, callback?: (...args: never[]) => void, target?: unknown): void;
  }

  export class Scene extends Node {}

  export class UITransform extends Component {
    public width: number;
    public height: number;
    public setContentSize(width: number, height: number): void;
    public setAnchorPoint(x: number, y: number): void;
  }

  export class Sprite extends Component {
    public static readonly SizeMode: {
      readonly CUSTOM: number;
      readonly TRIMMED: number;
      readonly RAW: number;
    };

    public spriteFrame: SpriteFrame | null;
    public color: Color;
    public sizeMode: number;
  }

  export class Label extends Component {
    public static readonly HorizontalAlign: {
      readonly LEFT: number;
      readonly CENTER: number;
      readonly RIGHT: number;
    };

    public string: string;
    public fontSize: number;
    public lineHeight: number;
    public color: Color;
    public isBold: boolean;
    public horizontalAlign: number;
  }

  export class UIOpacity extends Component {
    public opacity: number;
  }

  export class ImageAsset {
    constructor(nativeAsset?: unknown);
  }

  export class Texture2D {
    public static readonly PixelFormat: {
      readonly RGBA8888: number;
    };

    public image: ImageAsset | null;
  }

  export class SpriteFrame {
    public texture: Texture2D;
  }

  export class Director {
    public static readonly EVENT_AFTER_SCENE_LAUNCH: string;
    public getScene(): Scene | null;
    public on(event: string, callback: (...args: never[]) => void, target?: unknown): void;
    public once(event: string, callback: (...args: never[]) => void, target?: unknown): void;
  }

  export const director: Director;

  export const game: {
    pause(): void;
    resume(): void;
  };
}
