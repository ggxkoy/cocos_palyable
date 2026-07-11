import { MeshRenderer, Node } from 'cc';

// FBX 源文件的单位/比例不可控（厘米建模、烘焙缩放等都见过），
// 直接实例化可能大到糊满屏或小到看不见。这里按网格包围盒把模型
// 统一缩放到目标世界高度，保证「拖什么模型进槽位都可见」。
// targetHeight <= 0 表示不缩放（信任源文件）。
export function fitModelHeight(model: Node, targetHeight: number): number {
    if (targetHeight <= 0) {
        return 1;
    }
    let minY = Infinity;
    let maxY = -Infinity;
    for (const renderer of model.getComponentsInChildren(MeshRenderer)) {
        const struct = renderer.mesh?.struct;
        if (!struct?.minPosition || !struct?.maxPosition) {
            continue;
        }
        minY = Math.min(minY, struct.minPosition.y);
        maxY = Math.max(maxY, struct.maxPosition.y);
    }
    const rawHeight = maxY - minY;
    if (!isFinite(rawHeight) || rawHeight <= 0.0001) {
        return 1;
    }
    const factor = targetHeight / rawHeight;
    model.setScale(factor, factor, factor);
    return factor;
}
