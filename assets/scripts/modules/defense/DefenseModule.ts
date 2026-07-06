import { Color, Node, Prefab, SkeletalAnimation, instantiate } from 'cc';
import { createBox3D, setBoxColor } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { DefenseEnemy, DefenseSim, HitEvent } from './DefenseSim';

// 防御视觉：炮塔+驻守小兵、实体子弹、敌潮小兵与 BOSS。
// 命中三重反馈：受击动画（prefab 有 hit 剪辑就 crossFade，占位盒子做压缩弹跳）、
// 命中特效（白色冲击闪光）、闪白（白壳短暂罩住模型；真·菲涅耳边缘光
// 需要自定义 rim shader，美术阶段以 fresnel-flash.effect 替换此近似）。
// 血条：首次受击出现，按血量比例缩放。
// 死亡：死亡动画（prefab death 剪辑 / 占位盒子向后倒地），整体变灰、
// 下沉缩小渐隐后移除（真·透明渐隐需透明材质，美术阶段替换）。
const TURRET_BASE = new Color(70, 110, 170, 255);
const TURRET_BARREL = new Color(36, 48, 66, 255);
const SOLDIER = new Color(90, 140, 200, 255);
const ENEMY = new Color(200, 70, 60, 255);
const ENEMY_DARK = new Color(150, 40, 34, 255);
const BOSS = new Color(140, 36, 30, 255);
const GRAY = new Color(120, 120, 120, 255);
const BULLET = new Color(255, 236, 120, 255);
const MUZZLE = new Color(255, 250, 200, 255);
const IMPACT = new Color(255, 255, 255, 255);
const FLASH_SHELL = new Color(255, 255, 255, 255);
const BAR_BG = new Color(40, 20, 18, 255);
const BAR_FILL = new Color(90, 220, 90, 255);

const HIT_FLASH_TIME = 0.09;

interface EnemyView {
    readonly root: Node;
    readonly model: Node;
    readonly anim: SkeletalAnimation | null;
    readonly boxParts: Node[];
    readonly flashShell: Node;
    readonly barRoot: Node;
    readonly barFill: Node;
    readonly barWidth: number;
    readonly baseHeight: number;
    flashTimer: number;
    deathStarted: boolean;
    grayed: boolean;
}

interface TransientFx {
    readonly node: Node;
    life: number;
}

export class DefenseModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private readonly enemyViews = new Map<number, EnemyView>();
    private readonly bulletNodes = new Map<number, Node>();
    private readonly fx: TransientFx[] = [];

    constructor(
        private readonly defense: DefenseSim,
        private readonly turrets: ReadonlyArray<{ readonly x: number; readonly z: number }>,
        private readonly deathTime: number,
        private readonly enemyAnimClips: Readonly<Record<string, string>>,
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

        context.bus.on('fx:fire', payload => this.spawnMuzzleFlash(payload as { fromX: number; fromZ: number }));
        context.bus.on('fx:hit', payload => this.onHit(payload as HitEvent));
    }

    public tick(deltaTime: number): void {
        if (!this.context) {
            return;
        }
        this.syncEnemies(deltaTime);
        this.syncBullets();

        for (let i = this.fx.length - 1; i >= 0; i -= 1) {
            const item = this.fx[i];
            item.life -= deltaTime;
            if (item.life <= 0) {
                item.node.destroy();
                this.fx.splice(i, 1);
            }
        }
    }

    private syncEnemies(deltaTime: number): void {
        for (const enemy of this.defense.enemies) {
            let view = this.enemyViews.get(enemy.id);
            if (!view && enemy.state === 'alive') {
                view = this.createEnemyView(enemy);
                this.enemyViews.set(enemy.id, view);
            }
            if (!view) {
                continue;
            }

            if (enemy.state === 'gone') {
                view.root.destroy();
                this.enemyViews.delete(enemy.id);
                continue;
            }

            view.root.setPosition(enemy.x, 0, enemy.z);

            // 闪白回收。
            if (view.flashTimer > 0) {
                view.flashTimer -= deltaTime;
                if (view.flashTimer <= 0) {
                    view.flashShell.active = false;
                    view.model.setScale(1, 1, 1);
                }
            }

            // 血条：首次受击出现，按比例缩放。
            const showBar = enemy.hitCount > 0 && enemy.state === 'alive';
            view.barRoot.active = showBar;
            if (showBar) {
                const ratio = Math.max(0, enemy.hp / enemy.maxHp);
                view.barFill.setScale(ratio, 1, 1);
                view.barFill.setPosition(-view.barWidth * (1 - ratio) / 2, 0, 0.01);
            }

            // 死亡：死亡动画/倒地 → 变灰 → 下沉缩小渐隐。
            if (enemy.state === 'dying') {
                if (!view.deathStarted) {
                    view.deathStarted = true;
                    view.barRoot.active = false;
                    view.flashShell.active = false;
                    const deathClip = this.enemyAnimClips.death;
                    if (view.anim && deathClip && view.anim.getState(deathClip)) {
                        view.anim.crossFade(deathClip, 0.1);
                    }
                }
                if (!view.grayed) {
                    view.grayed = true;
                    for (const part of view.boxParts) {
                        setBoxColor(part, GRAY);
                    }
                }
                const progress = Math.min(1, Math.max(0, 1 - enemy.stateTimer / this.deathTime));
                if (!view.anim && view.boxParts.length > 0) {
                    // 占位盒子：向后倒地。
                    view.model.setRotationFromEuler(-Math.min(90, progress * 2 * 90), 0, 0);
                }
                // 渐隐近似：整体缩小 + 下沉（真透明渐隐待美术透明材质）。
                const shrink = 1 - progress * 0.75;
                view.root.setScale(shrink, shrink, shrink);
                view.root.setPosition(enemy.x, -progress * 0.45, enemy.z);
            }
        }
    }

    private syncBullets(): void {
        const seen = new Set<number>();
        for (const bullet of this.defense.bullets) {
            seen.add(bullet.id);
            let node = this.bulletNodes.get(bullet.id);
            if (!node) {
                node = createBox3D(`Bullet${bullet.id}`, this.context!.world, bullet.x, 0.55, bullet.z, 0.16, 0.16, 0.34, BULLET);
                this.bulletNodes.set(bullet.id, node);
            }
            node.setPosition(bullet.x, 0.55, bullet.z);
        }
        for (const [id, node] of Array.from(this.bulletNodes.entries())) {
            if (!seen.has(id)) {
                node.destroy();
                this.bulletNodes.delete(id);
            }
        }
    }

    private onHit(hit: HitEvent): void {
        // 命中特效：冲击闪光。
        if (this.context) {
            const impact = createBox3D('Impact', this.context.world, hit.x, 0.7, hit.z, 0.34, 0.34, 0.34, IMPACT);
            impact.setRotationFromEuler(45, 45, 0);
            this.fx.push({ node: impact, life: 0.08 });
        }

        const view = this.enemyViews.get(hit.enemyId);
        if (!view || view.deathStarted) {
            return;
        }
        // 受击动画：prefab 有 hit 剪辑就播，占位盒子做压缩弹跳。
        const hitClip = this.enemyAnimClips.hit;
        if (view.anim && hitClip && view.anim.getState(hitClip)) {
            view.anim.crossFade(hitClip, 0.05);
        } else {
            view.model.setScale(1.15, 0.78, 1.15);
        }
        // 闪白（菲涅耳近似）：白壳短暂罩住。
        view.flashShell.active = true;
        view.flashTimer = HIT_FLASH_TIME;
    }

    private spawnMuzzleFlash(fire: { fromX: number; fromZ: number }): void {
        if (!this.context) {
            return;
        }
        const flash = createBox3D('Muzzle', this.context.world, fire.fromX, 0.8, fire.fromZ - 0.6, 0.24, 0.24, 0.24, MUZZLE);
        flash.setRotationFromEuler(45, 0, 45);
        this.fx.push({ node: flash, life: 0.05 });
    }

    private createEnemyView(enemy: DefenseEnemy): EnemyView {
        const world = this.context!.world;
        const isBoss = enemy.kind === 'boss';
        const prefab = isBoss ? this.bossPrefab : this.enemyPrefab;
        const height = isBoss ? 1.4 : 0.8;

        const root = new Node(`${isBoss ? 'Boss' : 'Enemy'}${enemy.id}`);
        world.addChild(root);
        root.setPosition(enemy.x, 0, enemy.z);

        const model = new Node('Model');
        root.addChild(model);

        let anim: SkeletalAnimation | null = null;
        const boxParts: Node[] = [];
        if (prefab) {
            const instance = instantiate(prefab);
            model.addChild(instance);
            anim = instance.getComponentInChildren(SkeletalAnimation);
            const moveClip = this.enemyAnimClips.move;
            if (anim && moveClip && anim.getState(moveClip)) {
                anim.play(moveClip);
            }
        } else if (isBoss) {
            const body = createBox3D('Body', model, 0, 0.65, 0, 1.1, 1.3, 1.0, BOSS);
            const head = createBox3D('Head', model, 0, 1.5, 0, 0.5, 0.5, 0.5, BOSS);
            boxParts.push(body, head);
        } else {
            const body = createBox3D('Body', model, 0, 0.35, 0, 0.5, 0.7, 0.5, ENEMY);
            const cap = createBox3D('Cap', model, 0, 0.79, 0, 0.34, 0.18, 0.34, ENEMY_DARK);
            boxParts.push(body, cap);
        }

        // 闪白壳：略大于本体的白盒，命中瞬间点亮。
        const shellSize = isBoss ? 1.5 : 0.95;
        const flashShell = createBox3D('FlashShell', root, 0, height / 2 + 0.1, 0, shellSize, height + 0.25, shellSize, FLASH_SHELL);
        flashShell.active = false;

        // 血条：斜向相机的双层薄片，首次受击才出现。
        const barWidth = isBoss ? 1.4 : 0.72;
        const barRoot = new Node('HpBar');
        root.addChild(barRoot);
        barRoot.setPosition(0, height + 0.5, 0);
        barRoot.setRotationFromEuler(-38, 0, 0);
        createBox3D('BarBg', barRoot, 0, 0, 0, barWidth + 0.06, 0.14, 0.02, BAR_BG);
        const barFill = createBox3D('BarFill', barRoot, 0, 0, 0.01, barWidth, 0.09, 0.02, BAR_FILL);
        barRoot.active = false;

        return {
            root,
            model,
            anim,
            boxParts,
            flashShell,
            barRoot,
            barFill,
            barWidth,
            baseHeight: height,
            flashTimer: 0,
            deathStarted: false,
            grayed: false,
        };
    }
}
