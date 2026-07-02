import { Color, Node, UIOpacity } from 'cc';
import { clamp, toW, toX, toY } from './Layout';
import { createBox } from './PlaceholderFactory';

const DEFAULT_COLOR = new Color(255, 216, 95, 255);
const GRAVITY = 260;

interface Spark {
    readonly node: Node;
    readonly opacity: UIOpacity;
    webX: number;
    webY: number;
    vx: number;
    vy: number;
    life: number;
    readonly maxLife: number;
}

// Burst-style placeholder particles shared by the templates; positions are
// simulated in web space and mirrored onto box sprites each tick.
export class SparkSystem {
    private readonly sparks: Spark[] = [];

    constructor(private readonly layer: Node, private readonly color: Color = DEFAULT_COLOR) {}

    public burst(webX: number, webY: number, count: number): void {
        for (let i = 0; i < count; i += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 130;
            const node = createBox('Spark', this.layer, toX(webX), toY(webY), toW(12), toW(12), this.color);
            const opacity = node.addComponent(UIOpacity);
            this.sparks.push({
                node,
                opacity,
                webX,
                webY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.45 + Math.random() * 0.25,
                maxLife: 0.7,
            });
        }
    }

    public tick(deltaTime: number): void {
        for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
            const spark = this.sparks[i];
            spark.life -= deltaTime;
            if (spark.life <= 0) {
                spark.node.destroy();
                this.sparks.splice(i, 1);
                continue;
            }
            spark.webX += spark.vx * deltaTime;
            spark.webY += spark.vy * deltaTime;
            spark.vy += GRAVITY * deltaTime;

            const alpha = clamp(spark.life / spark.maxLife, 0, 1);
            spark.node.setPosition(toX(spark.webX), toY(spark.webY), 0);
            spark.node.setScale(0.5 + alpha * 0.5, 0.5 + alpha * 0.5, 1);
            spark.opacity.opacity = Math.round(alpha * 255);
        }
    }
}
