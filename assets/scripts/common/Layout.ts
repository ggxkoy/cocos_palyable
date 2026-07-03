// Shared coordinate helpers. Every template lays out its view in the
// reference web space (390x844, origin top-left, y down) used by the
// web/ preview slices, and converts to the 720x1280 design space here.
export const WEB_WIDTH = 390;
export const WEB_HEIGHT = 844;
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;
export const SCALE_X = DESIGN_WIDTH / WEB_WIDTH;
export const SCALE_Y = DESIGN_HEIGHT / WEB_HEIGHT;

export function toX(webX: number): number {
    return webX * SCALE_X - DESIGN_WIDTH * 0.5;
}

export function toY(webY: number): number {
    return DESIGN_HEIGHT * 0.5 - webY * SCALE_Y;
}

export function toW(webW: number): number {
    return webW * SCALE_X;
}

export function toH(webH: number): number {
    return webH * SCALE_Y;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
