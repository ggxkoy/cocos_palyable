import { AnimationClip, AnimationState, SkeletalAnimation } from 'cc';

// FBX 动画状态机：把 SkeletalAnimation 包装成「状态名 → 播放行为」的图，
// 视觉模块只负责报状态名，剪辑资产由 View 组件的 @property 槽位拖入。
// 支持两种状态：
//   整剪辑状态 —— 一个状态一条 AnimationClip（如 01_主角 的 @idle1/@walk1 系列）；
//   帧段状态 —— 美术把多个动作烘进同一条 Take 001（见 08_boss、09_炮塔小兵的
//               帧数说明 txt），用 from/to 帧号切段：状态速度置 0，手动推进采样。
const WRAP_NORMAL = 1;
const WRAP_LOOP = 2;

export interface AnimatorStateDef {
    readonly clip: AnimationClip | null;
    /** 默认循环；一次性动作（受击/死亡）设 false，播完停在末帧。 */
    readonly loop?: boolean;
    /** crossFade 时长，默认 0.15s。 */
    readonly fade?: number;
    /** 帧段起始帧号（与 to 同时给才启用帧段模式）。 */
    readonly from?: number;
    readonly to?: number;
    /** 帧段采样率，默认 30fps。 */
    readonly fps?: number;
}

interface AnimatorState {
    readonly def: AnimatorStateDef;
    readonly stateName: string;
    readonly handle: AnimationState;
    readonly segment: boolean;
}

export class FbxAnimator {
    private readonly states = new Map<string, AnimatorState>();
    private active: AnimatorState | null = null;
    private activeName = '';
    private segTime = 0;

    constructor(private readonly anim: SkeletalAnimation | null) {
        if (anim) {
            // 必须关掉预烘焙蒙皮：烘焙模式只认导入时烘好的剪辑，跨 FBX 挂进来的
            // 剪辑与帧段手动采样都没有烘焙数据，蒙皮会坍缩成一团（模型看不见）。
            anim.useBakedAnimation = false;
        }
    }

    public define(name: string, def: AnimatorStateDef): void {
        if (!this.anim || !def.clip) {
            return;
        }
        const stateName = `fsm:${name}`;
        const segment = def.from !== undefined && def.to !== undefined;
        const handle = this.anim.createState(def.clip, stateName);
        if (segment) {
            // 帧段模式不让引擎推时间，由 tick 手动定位采样。
            handle.speed = 0;
        } else {
            handle.wrapMode = def.loop === false ? WRAP_NORMAL : WRAP_LOOP;
        }
        this.states.set(name, { def, stateName, handle, segment });
    }

    public has(name: string): boolean {
        return this.states.has(name);
    }

    public get current(): string {
        return this.activeName;
    }

    /** 切状态；restart=true 时同状态也从头重播（受击这类一次性反馈用）。 */
    public set(name: string, restart = false): void {
        const state = this.states.get(name);
        if (!state || !this.anim) {
            return;
        }
        if (name === this.activeName && !restart) {
            return;
        }
        this.activeName = name;
        this.active = state;
        this.segTime = 0;
        this.anim.crossFade(state.stateName, state.def.fade ?? 0.15);
        if (state.segment) {
            this.applySegment(state);
        } else if (restart) {
            state.handle.setTime(0);
        }
    }

    public tick(deltaTime: number): void {
        const state = this.active;
        if (!state || !state.segment) {
            return;
        }
        this.segTime += deltaTime;
        this.applySegment(state);
    }

    private applySegment(state: AnimatorState): void {
        const def = state.def;
        const fps = def.fps ?? 30;
        const from = def.from ?? 0;
        const span = Math.max(1, (def.to ?? from) - from);
        const played = this.segTime * fps;
        const frame = def.loop === false ? Math.min(span, played) : played % span;
        state.handle.setTime((from + frame) / fps);
        state.handle.sample();
    }
}

/** 取模型自带的那条 Take 001（帧段模式的底剪辑）。 */
export function bakedClipOf(anim: SkeletalAnimation | null): AnimationClip | null {
    if (!anim) {
        return null;
    }
    return anim.defaultClip ?? anim.clips.find(clip => !!clip) ?? null;
}
