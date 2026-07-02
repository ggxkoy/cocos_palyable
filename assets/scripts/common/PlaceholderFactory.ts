import { Color, ImageAsset, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { toW } from './Layout';

let cachedWhiteFrame: SpriteFrame | null = null;

const WHITE: Color = new Color(255, 255, 255, 255);
const HAND_PALM = new Color(242, 210, 178, 255);
const HAND_TIP = new Color(255, 243, 223, 255);

export function getWhiteFrame(): SpriteFrame {
    if (cachedWhiteFrame) {
        return cachedWhiteFrame;
    }

    const side = 4;
    const pixels = new Uint8Array(side * side * 4).fill(255);
    const image = new ImageAsset({
        _data: pixels,
        width: side,
        height: side,
        format: Texture2D.PixelFormat.RGBA8888,
        _compressed: false,
    });

    const texture = new Texture2D();
    texture.image = image;

    const frame = new SpriteFrame();
    frame.texture = texture;
    cachedWhiteFrame = frame;
    return frame;
}

export function createNode(name: string, parent: Node, x: number, y: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    parent.addChild(node);
    node.setPosition(x, y, 0);
    return node;
}

export function createBox(
    name: string,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    frame: SpriteFrame | null = null,
): Node {
    const node = createNode(name, parent, x, y);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame ?? getWhiteFrame();
    sprite.color = frame ? WHITE.clone() : color;
    return node;
}

export function createLabel(
    name: string,
    parent: Node,
    x: number,
    y: number,
    text: string,
    fontSize: number,
    color: Color,
): Label {
    const node = createNode(name, parent, x, y);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 6;
    label.color = color;
    label.isBold = true;
    return label;
}

export function createHandHint(parent: Node, frame: SpriteFrame | null): Node {
    const hand = createNode('HandHint', parent, 0, 0);
    if (frame) {
        createBox('HandSprite', hand, 0, 0, toW(46), toW(64), WHITE, frame);
    } else {
        createBox('Palm', hand, toW(2), toW(5), toW(20), toW(50), HAND_PALM);
        createBox('Tip', hand, toW(4), -toW(26), toW(38), toW(38), HAND_TIP);
    }
    hand.angle = 20;
    return hand;
}
