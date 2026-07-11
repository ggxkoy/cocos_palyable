import { Component } from 'cc';
import { Salvage3DGame } from '../Salvage3DGame';

// View 组件的公共查找：沿父链找拼装宿主（宿主在 GameRoot，View 在其子节点）。
export function findHost(component: Component): Salvage3DGame | null {
    let node = component.node.parent;
    while (node) {
        const host = node.getComponent(Salvage3DGame);
        if (host) {
            return host;
        }
        node = node.parent;
    }
    return null;
}
