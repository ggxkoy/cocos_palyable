import { Color, Label, Node, SpriteFrame, UITransform } from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH, toH, toW, toX, toY } from './Layout';
import { createBox, createLabel, createNode } from './PlaceholderFactory';

const OVERLAY = new Color(5, 7, 8, 148);
const CARD = new Color(32, 40, 48, 255);
const TITLE = new Color(255, 242, 163, 255);
const SUBTITLE = new Color(231, 236, 236, 255);
const CTA_GOLD = new Color(241, 189, 50, 255);
const CTA_TEXT = new Color(32, 24, 4, 255);

export interface EndCardHandles {
    readonly root: Node;
    readonly ctaButton: Node;
    readonly title: Label;
    readonly subtitle: Label;
}

export interface EndCardOptions {
    readonly title: string;
    readonly subtitle: string;
    readonly ctaText: string;
    readonly buttonFrame: SpriteFrame | null;
}

// Shared placeholder end card: dim overlay, framed card, title/subtitle and a
// CTA button. Templates toggle `root.active` and re-word the labels per outcome.
export function buildEndCard(parent: Node, options: EndCardOptions): EndCardHandles {
    const root = createNode('EndCard', parent, 0, 0);
    root.active = false;

    const overlay = createBox('Overlay', root, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, OVERLAY);
    // Swallow taps behind the end card so only the CTA reacts.
    overlay.on(Node.EventType.TOUCH_END, () => undefined);

    createBox('Card', root, toX(195), toY(391), toW(302), toH(446), CARD);
    const title = createLabel('Title', root, toX(195), toY(230), options.title, 70, TITLE);
    const subtitle = createLabel('Subtitle', root, toX(195), toY(282), options.subtitle, 35, SUBTITLE);

    const cta = createNode('CtaButton', root, toX(195), toY(735));
    cta.addComponent(UITransform).setContentSize(toW(262), toH(70));
    createBox('CtaBg', cta, 0, 0, toW(262), toH(70), CTA_GOLD, options.buttonFrame);
    createLabel('CtaLabel', cta, 0, 0, options.ctaText, 48, CTA_TEXT);

    return { root, ctaButton: cta, title, subtitle };
}
