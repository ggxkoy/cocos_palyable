import { Color, Material, MeshRenderer, Node, primitives, utils } from 'cc';

// 3D 占位工具：运行时生成的纯色盒子网格（builtin-standard 材质），
// 与 2D 的 PlaceholderFactory 对应。替换真实美术时，用模型 prefab
// 换掉对应节点即可，节点命名与策划案资产清单一致。
export function makeBoxMaterial(color: Color): Material {
    const material = new Material();
    material.initialize({ effectName: 'builtin-standard' });
    material.setProperty('mainColor', color);
    return material;
}

export function createBox3D(
    name: string,
    parent: Node,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    length: number,
    color: Color,
): Node {
    const node = new Node(name);
    parent.addChild(node);
    node.setPosition(x, y, z);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = utils.MeshUtils.createMesh(primitives.box({ width, height, length }));
    renderer.material = makeBoxMaterial(color);
    return node;
}

export function setBoxColor(node: Node, color: Color): void {
    const renderer = node.getComponent(MeshRenderer);
    renderer?.material?.setProperty('mainColor', color);
}
