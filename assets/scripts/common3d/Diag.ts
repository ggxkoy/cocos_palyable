// 运行时诊断通道：console 里有、屏幕上也有（DebugOverlayModule 渲染）。
// 无编辑器/无 devtools 的验收场景下，一张游戏截图就能带回诊断信息。
const MAX_LINES = 26;
const lines: string[] = [];
let dirty = false;

export function diag(message: string): void {
    console.log(message);
    lines.push(message);
    if (lines.length > MAX_LINES) {
        lines.shift();
    }
    dirty = true;
}

export function diagText(): string {
    return lines.join('\n');
}

export function diagConsumeDirty(): boolean {
    const wasDirty = dirty;
    dirty = false;
    return wasDirty;
}
