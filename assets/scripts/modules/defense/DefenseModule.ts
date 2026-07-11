import { AnimationClip, Color, Node, Prefab, SkeletalAnimation, instantiate } from 'cc';
import { FbxAnimator, bakedClipOf } from '../../common3d/FbxAnimator';
import { fitModelHeight } from '../../common3d/ModelFit';
import { createBox3D, setBoxColor } from '../../common3d/Placeholder3D';
import { ModuleContext, PlayableModule } from '../../framework/Module';
import { DefenseEnemy, DefenseSim, HitEvent } from './DefenseSim';

// 防御视觉：炮塔+驻守小兵、实体子弹、敌潮小兵与 BOSS、围墙。
// 动画全部走 FbxAnimator 状态机：
//   小兵（06_敌军）用独立剪辑：move/attack 循环，hit/death 一次性；
//   BOSS（08_boss kulou）是单条 Take 001 按帧号切段（见目录里的动画帧数.txt）；
//   炮塔小兵（09）同理，持枪待机/站立开枪两段。
// 命中三重反馈：受击动画、命中特效（白色冲击闪光）、闪白（白壳近似菲涅耳，
// 美术阶段以 rim shader 替换）。血条首次受击出现；死亡→变灰下沉缩小渐隐。
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
const WALL = new Color(146, 124, 86, 255);
const WALL_TOP = new Color(120, 100, 68, 255);
const WALL_HIT = new Color(255, 96, 70, 255);
const WALL_BROKEN = new Color(96, 96, 96, 255);
const WALL_BAR = new Color(96, 176, 255, 255);

const HIT_FLASH_TIME = 0.09;
const HIT_ANIM_TIME = 0.35;
const WALL_FLASH_TIME = 0.12;
const SOLDIER_SHOOT_HOLD = 0.3;

// 08_boss（kulou）动画帧数.txt：待机0-60 移动120-140 攻击190-215 死亡70-110。
const BOSS_SEGMENTS = {
    move: { from: 120, to: 140 },
    attack: { from: 190, to: 215 },
    death: { from: 70, to: 110, loop: false },
} as const;

// 09_炮塔小兵（蓝兵）：持枪待机 0-30，站立开枪 40-47。
const SOLDIER_SEGMENTS = {
    idle: { from: 0, to: 30 },
    shoot: { from: 40, to: 47 },
} as const;

/** 敌潮小兵（06_敌军 Monster2）的剪辑槽位。 */
export interface EnemyClipSet {
    readonly move: AnimationClip | null;
    readonly attack: AnimationClip | null;
    readonly hit: AnimationClip | null;
    readonly death: AnimationClip | null;
}

export interface DefenseViewOptions {
    readonly turretPrefab: Prefab | null;
    readonly enemyPrefab: Prefab | null;
    readonly soldierPrefab: Prefab | null;
    readonly bossPrefab: Prefab | null;
    readonly enemyClips: EnemyClipSet;
    /** 自适应目标高度（米，0=不缩放）。 */
    readonly enemyHeight: number;
    readonly bossHeight: number;
    readonly soldierHeight: number;
    readonly turretHeight: number;
    /** 围墙位置与宽度；null 则不渲染墙。 */
    readonly wall: { readonly z: number; readonly width: number } | null;
}

interface EnemyView {
    readonly root: Node;
    readonly model: Node;
    readonly animator: FbxAnimator | null;
    readonly boxParts: Node[];
    readonly flashShell: Node;
    readonly barRoot: Node;
    readonly barFill: Node;
    readonly barWidth: number;
    flashTimer: number;
    hitAnimTimer: number;
    deathStarted: boolean;
    grayed: boolean;
}

interface TurretView {
    readonly x: number;
    readonly animator: FbxAnimator | null;
    fireTimer: number;
}

interface TransientFx {
    readonly node: Node;
    life: number;
}

interface WallSegment {
    readonly node: Node;
    readonly x: number;
    flashTimer: number;
}

export class DefenseModule implements PlayableModule {
    private context: ModuleContext | null = null;
    private readonly enemyViews = new Map<number, EnemyView>();
    private readonly bulletNodes = new Map<number, Node>();
    private readonly turretViews: TurretView[] = [];
    private readonly fx: TransientFx[] = [];
    private readonly wallSegments: WallSegment[] = [];
    private wallBarFill: Node | null = null;
    private wallBarRoot: Node | null = null;
    private wallBroken = false;

    constructor(
        private readonly defense: DefenseSim,
        private readonly turrets: ReadonlyArray<{ readonly x: number; readonly z: number }>,
        private readonly deathTime: number,
        private readonly lineZ: number,
        private readonly options: DefenseViewOptions,
    ) {}

    public start(context: ModuleContext): void {
        this.context = context;
        for (const [index, turret] of this.turrets.entries()) {
            let root: Node;
            if (this.options.turretPrefab) {
                root = instantiate(this.options.turretPrefab);
                root.name = `Turret${index + 1}`;
                root.setPosition(turret.x, 0, turret.z);
                context.world.addChild(root);
                fitModelHeight(root, this.options.turretHeight);
            } else {
                root = createBox3D(`Turret${index + 1}`, context.world, turret.x, 0.4, turret.z, 0.9, 0.8, 0.9, TURRET_BASE);
                const barrel = createBox3D('Barrel', root, 0, 0.35, 0.55, 0.22, 0.22, 0.9, TURRET_BARREL);
                barrel.setPosition(0, 0.35, 0.55);
            }

            // 驻守小兵：单条 Take 001 帧段（待机/开枪），开火瞬间切开枪段。
            let animator: FbxAnimator | null = null;
            if (this.options.soldierPrefab) {
                const soldier = instantiate(this.options.soldierPrefab);
                soldier.name = 'TurretSoldier';
                context.world.addChild(soldier);
                soldier.setPosition(turret.x - 0.75, 0, turret.z + 0.35);
                fitModelHeight(soldier, this.options.soldierHeight);
                const anim = soldier.getComponentInChildren(SkeletalAnimation);
                animator = new FbxAnimator(anim);
                const baked = bakedClipOf(anim);
                animator.define('idle', { clip: baked, ...SOLDIER_SEGMENTS.idle });
                animator.define('shoot', { clip: baked, ...SOLDIER_SEGMENTS.shoot, fade: 0.06 });
                animator.set('idle');
            } else {
                const soldier = createBox3D('TurretSoldier', root, 0, 0.75, 0, 0.3, 0.55, 0.26, SOLDIER);
                createBox3D('SoldierHead', soldier, 0, 0.42, 0, 0.22, 0.22, 0.22, SOLDIER);
            }
            this.turretViews.push({ x: turret.x, animator, fireTimer: 0 });
        }

        // 围墙：敌人攻墙的目标。分段沙袋墙 + 耐久条（受击出现），
        // 段位受击红闪，击破整体变灰塌陷，复活重试时修复。
        if (this.options.wall) {
            const wall = this.options.wall;
            const segmentCount = Math.max(4, Math.ceil(wall.width / 1.3));
            const segmentWidth = wall.width / segmentCount;
            for (let i = 0; i < segmentCount; i += 1) {
                const x = -wall.width / 2 + segmentWidth * (i + 0.5);
                const node = createBox3D(`WallSeg${i}`, context.world, x, 0.42, wall.z - 0.32, segmentWidth - 0.1, 0.84, 0.5, WALL);
                createBox3D('WallCap', node, 0, 0.52, 0, segmentWidth - 0.24, 0.2, 0.36, WALL_TOP);
                this.wallSegments.push({ node, x, flashTimer: 0 });
            }
            const barRoot = new Node('WallBar');
            context.world.addChild(barRoot);
            barRoot.setPosition(0, 1.6, wall.z - 0.32);
            barRoot.setRotationFromEuler(-38, 0, 0);
            const barWidth = Math.min(4.4, wall.width * 0.5);
            createBox3D('WallBarBg', barRoot, 0, 0, 0, barWidth + 0.08, 0.18, 0.02, BAR_BG);
            this.wallBarFill = createBox3D('WallBarFill', barRoot, 0, 0, 0.01, barWidth, 0.12, 0.02, WALL_BAR);
            barRoot.active = false;
            this.wallBarRoot = barRoot;

            context.bus.on('wall:hit', payload => this.onWallHit(payload as { x: number }));
            context.bus.on('wall:breached', () => this.setWallBroken(true));
            context.bus.on('goal:revive', () => this.setWallBroken(false));
        }

        context.bus.on('fx:fire', payload => this.onFire(payload as { fromX: number; fromZ: number }));
        context.bus.on('fx:hit', payload => this.onHit(payload as HitEvent));
    }

    public tick(deltaTime: number): void {
        if (!this.context) {
            return;
        }
        this.syncEnemies(deltaTime);
        this.syncBullets();
        this.syncWall(deltaTime);
        this.syncTurrets(deltaTime);

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

            // 动画状态机：死亡 > 受击 > 攻墙 > 行军。
            if (view.animator) {
                if (enemy.state === 'dying') {
                    view.animator.set('death');
                } else if (view.hitAnimTimer > 0) {
                    view.hitAnimTimer -= deltaTime;
                } else if (enemy.z <= this.lineZ + 0.02) {
                    view.animator.set('attack');
                } else {
                    view.animator.set('move');
                }
                view.animator.tick(deltaTime);
            }

            // 死亡：死亡动画/倒地 → 变灰 → 下沉缩小渐隐。
            if (enemy.state === 'dying') {
                if (!view.deathStarted) {
                    view.deathStarted = true;
                    view.barRoot.active = false;
                    view.flashShell.active = false;
                }
                if (!view.grayed) {
                    view.grayed = true;
                    for (const part of view.boxParts) {
                        setBoxColor(part, GRAY);
                    }
                }
                const progress = Math.min(1, Math.max(0, 1 - enemy.stateTimer / this.deathTime));
                if (!view.animator && view.boxParts.length > 0) {
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

    private syncTurrets(deltaTime: number): void {
        for (const view of this.turretViews) {
            if (!view.animator) {
                continue;
            }
            if (view.fireTimer > 0) {
                view.fireTimer -= deltaTime;
                view.animator.set('shoot');
            } else {
                view.animator.set('idle');
            }
            view.animator.tick(deltaTime);
        }
    }

    private syncWall(deltaTime: number): void {
        // 耐久条：掉过血才出现，按比例缩放。
        if (this.wallBarRoot && this.wallBarFill) {
            const damaged = this.defense.wallHp < this.defense.wallMaxHp;
            this.wallBarRoot.active = damaged && !this.wallBroken;
            if (damaged) {
                const ratio = Math.max(0, this.defense.wallHp / this.defense.wallMaxHp);
                this.wallBarFill.setScale(ratio, 1, 1);
            }
        }
        for (const segment of this.wallSegments) {
            if (segment.flashTimer > 0) {
                segment.flashTimer -= deltaTime;
                if (segment.flashTimer <= 0 && !this.wallBroken) {
                    setBoxColor(segment.node, WALL);
                }
            }
        }
    }

    private onWallHit(hit: { x: number }): void {
        // 最近的段位红闪一下 + 冲击闪光。
        let best: WallSegment | null = null;
        for (const segment of this.wallSegments) {
            if (!best || Math.abs(segment.x - hit.x) < Math.abs(best.x - hit.x)) {
                best = segment;
            }
        }
        if (best && !this.wallBroken) {
            setBoxColor(best.node, WALL_HIT);
            best.flashTimer = WALL_FLASH_TIME;
        }
        if (this.context && this.options.wall) {
            const impact = createBox3D('WallImpact', this.context.world, hit.x, 0.85, this.options.wall.z - 0.1, 0.3, 0.3, 0.3, IMPACT);
            impact.setRotationFromEuler(45, 45, 0);
            this.fx.push({ node: impact, life: 0.08 });
        }
    }

    private setWallBroken(broken: boolean): void {
        this.wallBroken = broken;
        for (const segment of this.wallSegments) {
            segment.flashTimer = 0;
            setBoxColor(segment.node, broken ? WALL_BROKEN : WALL);
            // 击破塌陷成半高，修复回正。
            segment.node.setScale(1, broken ? 0.35 : 1, 1);
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
        // 受击动画：状态机有 hit 状态就重播（BOSS 无受击段则保持当前段），
        // 占位盒子做压缩弹跳。
        if (view.animator?.has('hit')) {
            view.animator.set('hit', true);
            view.hitAnimTimer = HIT_ANIM_TIME;
        } else if (!view.animator) {
            view.model.setScale(1.15, 0.78, 1.15);
        }
        // 闪白（菲涅耳近似）：白壳短暂罩住。
        view.flashShell.active = true;
        view.flashTimer = HIT_FLASH_TIME;
    }

    private onFire(fire: { fromX: number; fromZ: number }): void {
        this.spawnMuzzleFlash(fire);
        // 开火的那座炮塔小兵切开枪段。
        let best: TurretView | null = null;
        for (const view of this.turretViews) {
            if (!best || Math.abs(view.x - fire.fromX) < Math.abs(best.x - fire.fromX)) {
                best = view;
            }
        }
        if (best) {
            best.fireTimer = SOLDIER_SHOOT_HOLD;
        }
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
        const prefab = isBoss ? this.options.bossPrefab : this.options.enemyPrefab;
        const height = isBoss ? 1.4 : 0.8;

        const root = new Node(`${isBoss ? 'Boss' : 'Enemy'}${enemy.id}`);
        world.addChild(root);
        root.setPosition(enemy.x, 0, enemy.z);

        const model = new Node('Model');
        root.addChild(model);

        let animator: FbxAnimator | null = null;
        const boxParts: Node[] = [];
        if (prefab) {
            const instance = instantiate(prefab);
            model.addChild(instance);
            // 敌人朝防线（-z）行军，模型面向行军方向。
            instance.setRotationFromEuler(0, 180, 0);
            fitModelHeight(instance, isBoss ? this.options.bossHeight : this.options.enemyHeight);
            const anim = instance.getComponentInChildren(SkeletalAnimation);
            animator = new FbxAnimator(anim);
            if (isBoss) {
                // BOSS：单条 Take 001 帧段（见 08_boss/动画帧数.txt）。
                const baked = bakedClipOf(anim);
                animator.define('move', { clip: baked, ...BOSS_SEGMENTS.move });
                animator.define('attack', { clip: baked, ...BOSS_SEGMENTS.attack });
                animator.define('death', { clip: baked, ...BOSS_SEGMENTS.death });
            } else {
                const clips = this.options.enemyClips;
                animator.define('move', { clip: clips.move });
                animator.define('attack', { clip: clips.attack });
                animator.define('hit', { clip: clips.hit, loop: false, fade: 0.05 });
                animator.define('death', { clip: clips.death, loop: false, fade: 0.1 });
            }
            animator.set('move');
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
            animator,
            boxParts,
            flashShell,
            barRoot,
            barFill,
            barWidth,
            flashTimer: 0,
            hitAnimTimer: 0,
            deathStarted: false,
            grayed: false,
        };
    }
}
