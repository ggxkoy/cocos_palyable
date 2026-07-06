import { Color, Node, Prefab, instantiate } from 'cc';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { DefenseFire, DefenseSim } from './DefenseSim';

// 防御视觉：常驻炮塔（压力侧锚点）、敌潮方块、短驻留激光束。
const TURRET_BASE = new Color(70, 110, 170, 255);
const TURRET_BARREL = new Color(36, 48, 66, 255);
const ENEMY = new Color(200, 70, 60, 255);
const LASER = new Color(120, 220, 255, 255);

export class DefenseModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private readonly enemyNodes = new Map<number, Node>();
    private readonly lasers: Array<{ node: Node; life: number }> = [];

    constructor(
        private readonly defense: DefenseSim,
        private readonly turrets: ReadonlyArray<{ readonly x: number; readonly z: number }>,
        private readonly turretPrefab: Prefab | null,
        private readonly enemyPrefab: Prefab | null,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;
        for (const [index, turret] of this.turrets.entries()) {
            if (this.turretPrefab) {
                const root = instantiate(this.turretPrefab);
                root.name = `Turret${index + 1}`;
                root.setPosition(turret.x, 0, turret.z);
                context.world.addChild(root);
            } else {
                const root = createBox3D(`Turret${index + 1}`, context.world, turret.x, 0.4, turret.z, 0.9, 0.8, 0.9, TURRET_BASE);
                const barrel = createBox3D('Barrel', root, 0, 0.35, 0.55, 0.22, 0.22, 0.9, TURRET_BARREL);
                barrel.setPosition(0, 0.35, 0.55);
            }
        }
        context.bus.on('fx:fire', payload => this.spawnLaser(payload as DefenseFire));
    }

    public tick(deltaTime: number): void {
        if (!this.context) {
            return;
        }
        for (const enemy of this.defense.enemies) {
            let node = this.enemyNodes.get(enemy.id);
            if (!node) {
                if (this.enemyPrefab) {
                    node = instantiate(this.enemyPrefab);
                    node.name = `Enemy${enemy.id}`;
                    node.setPosition(enemy.x, 0, enemy.z);
                    this.context.world.addChild(node);
                } else {
                    node = createBox3D(`Enemy${enemy.id}`, this.context.world, enemy.x, 0.35, enemy.z, 0.5, 0.7, 0.5, ENEMY);
                }
                this.enemyNodes.set(enemy.id, node);
            }
            node.active = enemy.alive;
            if (enemy.alive) {
                node.setPosition(enemy.x, this.enemyPrefab ? 0 : 0.35, enemy.z);
            }
        }

        for (let i = this.lasers.length - 1; i >= 0; i -= 1) {
            const laser = this.lasers[i];
            laser.life -= deltaTime;
            if (laser.life <= 0) {
                laser.node.destroy();
                this.lasers.splice(i, 1);
            }
        }
    }

    private spawnLaser(fire: DefenseFire): void {
        if (!this.context) {
            return;
        }
        const dx = fire.toX - fire.fromX;
        const dz = fire.toZ - fire.fromZ;
        const length = Math.hypot(dx, dz);
        const node = createBox3D('Laser', this.context.world, (fire.fromX + fire.toX) / 2, 0.6, (fire.fromZ + fire.toZ) / 2, 0.09, 0.09, length, LASER);
        node.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
        this.lasers.push({ node, life: 0.1 });
    }
}
