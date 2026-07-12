import { Color, MeshRenderer, Node } from 'cc';
import { diag } from './Diag';
import { createBox3D } from './Placeholder3D';

// FBX 源文件的单位/比例不可控（厘米建模、导入器把单位换算烘进某个子节点的
// scale 等都见过），直接实例化可能大到糊满屏、小到看不见。这里统一处理：
//   1) layer 归一化——导入 prefab 的子节点 layer 不一定等于相机可见层；
//   2) 双路找渲染器——先按类查（getComponentsInChildren），查不到再按
//      构造器名字链模糊匹配整棵树（防类标识不一致的极端情况）；
//   3) 量「实际」高度——网格包围盒 × 从渲染节点到模型根的缩放链；
//   4) 缩放到目标世界高度（乘在根节点现有 scale 上，而非覆盖）。
// 每次调用 diag 一行（屏幕诊断面板可见）；prefab 里连一个 MeshRenderer 都
// 没有时补一个洋红盒子，并 dump 节点数与组件类名——「看不见」必须留下线索。
const LAYER_DEFAULT = 1 << 30;
const MISSING = new Color(255, 0, 200, 255);

export function setLayerRecursively(node: Node, layer: number): void {
    node.layer = layer;
    for (const child of node.children) {
        setLayerRecursively(child, layer);
    }
}

// 构造器原型链上是否出现 MeshRenderer（涵盖 SkinnedMeshRenderer 等子类）。
function isRendererLike(component: object): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ctor: any = component.constructor;
    while (ctor) {
        if (typeof ctor.name === 'string' && ctor.name.indexOf('MeshRenderer') >= 0) {
            return true;
        }
        ctor = Object.getPrototypeOf(ctor);
    }
    return false;
}

function collectTree(model: Node): { nodes: number; componentNames: Set<string>; fuzzyRenderers: MeshRenderer[] } {
    let nodes = 0;
    const componentNames = new Set<string>();
    const fuzzyRenderers: MeshRenderer[] = [];
    (function walk(node: Node): void {
        nodes += 1;
        for (const component of node.components) {
            componentNames.add(component.constructor.name);
            if (isRendererLike(component)) {
                fuzzyRenderers.push(component as MeshRenderer);
            }
        }
        for (const child of node.children) {
            walk(child);
        }
    })(model);
    return { nodes, componentNames, fuzzyRenderers };
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
    const name = label || model.name;

    let renderers = model.getComponentsInChildren(MeshRenderer);
    let via = 'class';
    if (renderers.length === 0) {
        const tree = collectTree(model);
        renderers = tree.fuzzyRenderers;
        via = 'name-scan';
        if (renderers.length === 0) {
            diag(`[ModelFit] ${name}: NO renderer! nodes=${tree.nodes} comps=[${Array.from(tree.componentNames).join(',') || 'none'}]`);
            createBox3D('MissingModel', model, 0, 0.6, 0, 0.6, 1.2, 0.6, MISSING);
            return 1;
        }
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
    diag(`[ModelFit] ${name}: r=${renderers.length}(${via}) h=${worldHeight.toFixed(2)}m t=${targetHeight} f=${factor.toFixed(3)}`);
    return factor;
}
