import { Color, Node, Prefab, instantiate } from 'cc';
import { createBox3D } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { DefenseFire, DefenseSim } from './DefenseSim';

// 防御视觉：常驻炮塔+驻守小兵（压力侧锚点）、敌潮小兵与 BOSS、短驻留激光束。
// 美术槽位：05_炮塔→turretPrefab、09_炮塔小兵→soldierPrefab、
// 06_敌军→enemyPrefab、08_boss→bossPrefab；留空用占位盒子。
const TURRET_BASE = new Color(70, 110, 170, 255);
const TURRET_BARREL = new Color(36, 48, 66, 255);
const SOLDIER = new Color(90, 140, 200, 255);
const ENEMY = new Color(200, 70, 60, 255);
const BOSS = new Color(140, 36, 30, 255);
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
        private readonly soldierPrefab: Prefab | null = null,
        private readonly bossPrefab: Prefab | null = null,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;
        for (const [index, turret] of this.turrets.entries()) {
            let root: Node;
            if (this.turretPrefab) {
                root = instantiate(this.turretPrefab);
                root.name = `Turret${index + 1}`;
                root.setPosition(turret.x, 0, turret.z);
                context.world.addChild(root);
            } else {
                root = createBox3D(`Turret${index + 1}`, context.world, turret.x, 0.4, turret.z, 0.9, 0.8, 0.9, TURRET_BASE);
                const barrel = createBox3D('Barrel', root, 0, 0.35, 0.55, 0.22, 0.22, 0.9, TURRET_BARREL);
                barrel.setPosition(0, 0.35, 0.55);
            }
            // 驻守小兵（09_炮塔小兵）：站在塔顶，面向敌潮方向。
            if (this.soldierPrefab) {
                const soldier = instantiate(this.soldierPrefab);
                soldier.name = 'TurretSoldier';
                soldier.setPosition(0, this.turretPrefab ? 0 : 0.45, 0);
                root.addChild(soldier);
            } else {
                const soldier = createBox3D('TurretSoldier', root, 0, 0.75, 0, 0.3, 0.55, 0.26, SOLDIER);
                createBox3D('SoldierHead', soldier, 0, 0.42, 0, 0.22, 0.22, 0.22, SOLDIER);
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
            const prefab = enemy.kind === 'boss' ? this.bossPrefab : this.enemyPrefab;
            if (!node) {
                if (prefab) {
                    node = instantiate(prefab);
                    node.name = `${enemy.kind === 'boss' ? 'Boss' : 'Enemy'}${enemy.id}`;
                    node.setPosition(enemy.x, 0, enemy.z);
                    this.context.world.addChild(node);
                } else if (enemy.kind === 'boss') {
                    node = createBox3D(`Boss${enemy.id}`, this.context.world, enemy.x, 0.65, enemy.z, 1.1, 1.3, 1.0, BOSS);
                    createBox3D('BossHead', node, 0, 0.85, 0, 0.5, 0.5, 0.5, BOSS);
                } else {
                    node = createBox3D(`Enemy${enemy.id}`, this.context.world, enemy.x, 0.35, enemy.z, 0.5, 0.7, 0.5, ENEMY);
                }
                this.enemyNodes.set(enemy.id, node);
            }
            node.active = enemy.alive;
            if (enemy.alive) {
                node.setPosition(enemy.x, prefab ? 0 : (enemy.kind === 'boss' ? 0.65 : 0.35), enemy.z);
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
