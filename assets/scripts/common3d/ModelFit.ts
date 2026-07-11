import { Color, MeshRenderer, Node } from 'cc';
import { createBox3D } from './Placeholder3D';

// FBX 源文件的单位/比例不可控（厘米建模、导入器把单位换算烘进某个子节点的
// scale 等都见过），直接实例化可能大到糊满屏、小到看不见。这里统一处理：
//   1) layer 归一化——导入 prefab 的子节点 layer 不一定等于相机可见层；
//   2) 量「实际」高度——网格包围盒 × 从渲染节点到模型根的缩放链（不能只看
//      raw 网格数据，否则会把导入器已做的单位换算再除一遍）；
//   3) 缩放到目标世界高度（乘在根节点现有 scale 上，而非覆盖）。
// 每次调用都打一行诊断日志；prefab 里连一个 MeshRenderer 都没有时补一个
// 洋红盒子占位——「看不见」永远有可见的线索。
const LAYER_DEFAULT = 1 << 30;
const MISSING = new Color(255, 0, 200, 255);

export function setLayerRecursively(node: Node, layer: number): void {
    node.layer = layer;
    for (const child of node.children) {
        setLayerRecursively(child, layer);
    }
}

// 渲染节点相对模型根的累计 y 缩放（含模型根自身——导入器常把单位换算放这里）。
function chainScaleY(node: Node, root: Node): number {
    let scale = 1;
    let cursor: Node | null = node;
    while (cursor) {
        scale *= cursor.getScale().y;
        if (cursor === root) {
            break;
        }
        cursor = cursor.parent;
    }
    return scale;
}

export function fitModelHeight(model: Node, targetHeight: number, label = ''): number {
    setLayerRecursively(model, LAYER_DEFAULT);

    const renderers = model.getComponentsInChildren(MeshRenderer);
    if (renderers.length === 0) {
        console.warn(`[ModelFit] ${label || model.name}: prefab has NO MeshRenderer — showing magenta box placeholder`);
        createBox3D('MissingModel', model, 0, 0.6, 0, 0.6, 1.2, 0.6, MISSING);
        return 1;
    }

    let worldHeight = 0;
    for (const renderer of renderers) {
        const struct = renderer.mesh?.struct;
        if (!struct?.minPosition || !struct?.maxPosition) {
            continue;
        }
        const rawHeight = struct.maxPosition.y - struct.minPosition.y;
        worldHeight = Math.max(worldHeight, rawHeight * Math.abs(chainScaleY(renderer.node, model)));
    }

    let factor = 1;
    if (targetHeight > 0 && isFinite(worldHeight) && worldHeight > 0.0001) {
        factor = targetHeight / worldHeight;
        const current = model.getScale();
        model.setScale(current.x * factor, current.y * factor, current.z * factor);
    }
    console.log(`[ModelFit] ${label || model.name}: renderers=${renderers.length} measuredHeight=${worldHeight.toFixed(3)}m target=${targetHeight} factor=${factor.toFixed(4)}`);
    return factor;
}
