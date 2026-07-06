import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';
import { EnemyContact } from '../avatar/AvatarSim';

// 敌潮防御模块（纯逻辑）：
// - 渗透波（首次雇佣后开启）+ 终局敌潮与 BOSS（打捞大飞机触发）；
// - 炮塔发射【实体子弹】：追踪飞行、命中才结算伤害（fx:hit 三重反馈由视觉层做）；
//   每发消耗弹药，没弹药停火；优先攻击 BOSS，其次离防线最近的小兵；
// - 敌人状态机 alive → dying → gone：受击出血条，血量归零播死亡（变灰渐隐），
//   死亡瞬间掉金币（bus 'enemy:down'）。
export interface DefenseConfig {
    readonly turrets: ReadonlyArray<{ readonly x: number; readonly z: number }>;
    readonly enemyCount: number;
    readonly enemySpeed: number;
    readonly gruntHp: number;
    readonly bossCount: number;
    readonly bossHp: number;
    readonly bossSpeed: number;
    readonly fireInterval: number;
    readonly bulletSpeed: number;
    readonly deathTime: number;
    readonly spawnZ: number;
    readonly lineZ: number;
    readonly fieldHalfWidth: number;
    readonly trickleInterval: number;
    readonly trickleCount: number;
}

export type DefenseEnemyKind = 'grunt' | 'boss';

export type DefenseEnemyState = 'alive' | 'dying' | 'gone';

export interface DefenseEnemy {
    readonly id: number;
    readonly kind: DefenseEnemyKind;
    readonly maxHp: number;
    x: number;
    z: number;
    hp: number;
    state: DefenseEnemyState;
    stateTimer: number;
    hitCount: number;
}

export interface DefenseBullet {
    readonly id: number;
    readonly targetId: number;
    x: number;
    z: number;
}

export interface HitEvent {
    readonly enemyId: number;
    readonly x: number;
    readonly z: number;
    readonly died: boolean;
}

export class DefenseSim {
    public readonly enemies: DefenseEnemy[] = [];
    public readonly bullets: DefenseBullet[] = [];
    public trickleActive = false;

    private fireTimer = 0;
    private trickleTimer = 0;
    private turretIndex = 0;
    private nextId = 1;
    private nextBulletId = 1;
    private spawnCursor = 0;
    private finaleStarted = false;
    private clearedEmitted = false;
    private progress: (() => number) | null = null;

    constructor(
        private readonly config: DefenseConfig,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {
        bus.on('goal:vault', () => {
            // 终局：渗透波停止，敌潮+BOSS 总攻。演出没有时长——清场才结束。
            this.trickleActive = false;
            this.finaleStarted = true;
            this.spawnFinalHorde();
        });
    }

    // 玩家进度探针（已购买数）：进度越深渗透波越密——压力随行为增长，不随时间。
    public attachProgress(probe: () => number): void {
        this.progress = probe;
    }

    public startTrickle(): void {
        if (this.finaleStarted) {
            return;
        }
        this.trickleActive = true;
        this.trickleTimer = 0.8;
    }

    // 主角战斗用的感知查询（只认活着的）。
    public nearestAlive(x: number, z: number, range: number): EnemyContact | null {
        let best: DefenseEnemy | null = null;
        let bestDistance = range;
        for (const enemy of this.enemies) {
            if (enemy.state !== 'alive') {
                continue;
            }
            const distance = Math.hypot(enemy.x - x, enemy.z - z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = enemy;
            }
        }
        return best ? { id: best.id, x: best.x, z: best.z } : null;
    }

    // 统一的伤害入口（炮塔子弹命中 / 主角近战远程都走这里），
    // 视觉层监听 fx:hit 做三重反馈：受击动画、命中特效、闪白。
    public damage(enemyId: number, amount: number): boolean {
        const enemy = this.enemies.find(item => item.id === enemyId);
        if (!enemy || enemy.state !== 'alive') {
            return false;
        }
        enemy.hp -= amount;
        enemy.hitCount += 1;
        const died = enemy.hp <= 0;
        if (died) {
            enemy.state = 'dying';
            enemy.stateTimer = this.config.deathTime;
            this.bus.emit('enemy:down', { x: enemy.x, z: enemy.z, kind: enemy.kind });
        }
        const hit: HitEvent = { enemyId: enemy.id, x: enemy.x, z: enemy.z, died };
        this.bus.emit('fx:hit', hit);
        return died;
    }

    public tick(deltaTime: number): void {
        if (this.trickleActive) {
            this.trickleTimer -= deltaTime;
            if (this.trickleTimer <= 0) {
                // 压力随玩家进度加密（已购买数越多波次越紧），不是秒表脚本。
                const progress = this.progress?.() ?? 0;
                this.trickleTimer = this.config.trickleInterval / (1 + 0.3 * progress);
                for (let i = 0; i < this.config.trickleCount; i += 1) {
                    this.spawnGrunt();
                }
            }
        }

        for (const enemy of this.enemies) {
            if (enemy.state === 'alive') {
                const speed = enemy.kind === 'boss' ? this.config.bossSpeed : this.config.enemySpeed;
                enemy.z = Math.max(this.config.lineZ, enemy.z - speed * deltaTime);
            } else if (enemy.state === 'dying') {
                enemy.stateTimer -= deltaTime;
                if (enemy.stateTimer <= 0) {
                    enemy.state = 'gone';
                }
            }
        }

        // 子弹追踪飞行：命中才结算伤害；目标没了就哑火消散。
        for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
            const bullet = this.bullets[i];
            const target = this.enemies.find(item => item.id === bullet.targetId);
            if (!target || target.state !== 'alive') {
                this.bullets.splice(i, 1);
                continue;
            }
            const dx = target.x - bullet.x;
            const dz = target.z - bullet.z;
            const distance = Math.hypot(dx, dz);
            const step = this.config.bulletSpeed * deltaTime;
            if (distance <= Math.max(0.28, step)) {
                this.bullets.splice(i, 1);
                this.damage(target.id, 1);
                continue;
            }
            bullet.x += (dx / distance) * step;
            bullet.z += (dz / distance) * step;
        }

        if (this.finaleStarted && !this.clearedEmitted) {
            const anyAlive = this.enemies.some(enemy => enemy.state === 'alive');
            if (!anyAlive && this.bullets.length === 0) {
                this.clearedEmitted = true;
                this.bus.emit('defense:cleared');
            }
        }

        this.fireTimer -= deltaTime;
        while (this.fireTimer <= 0) {
            // 没弹药就停火——去打捞补给，这就是压力循环。
            if (!this.economy.hasAmmo()) {
                this.fireTimer = 0;
                break;
            }
            const target = this.pickTarget();
            if (!target) {
                this.fireTimer = 0;
                break;
            }
            const turret = this.config.turrets[this.turretIndex % this.config.turrets.length];
            this.turretIndex += 1;
            this.economy.consumeAmmo(1);
            this.bullets.push({ id: this.nextBulletId, targetId: target.id, x: turret.x, z: turret.z });
            this.nextBulletId += 1;
            // 枪口反馈（视觉层做火光/后座）。
            this.bus.emit('fx:fire', { fromX: turret.x, fromZ: turret.z, toX: target.x, toZ: target.z });
            this.fireTimer += this.config.fireInterval;
        }
    }

    // 优先 BOSS，其次离防线最近（z 最小）的小兵。
    private pickTarget(): DefenseEnemy | null {
        let boss: DefenseEnemy | null = null;
        let grunt: DefenseEnemy | null = null;
        for (const enemy of this.enemies) {
            if (enemy.state !== 'alive') {
                continue;
            }
            if (enemy.kind === 'boss') {
                if (!boss || enemy.z < boss.z) {
                    boss = enemy;
                }
            } else if (!grunt || enemy.z < grunt.z) {
                grunt = enemy;
            }
        }
        return boss ?? grunt;
    }

    private spawnGrunt(): void {
        const width = this.config.fieldHalfWidth * 2;
        this.spawnCursor += 1;
        this.enemies.push({
            id: this.nextId,
            kind: 'grunt',
            maxHp: this.config.gruntHp,
            x: -this.config.fieldHalfWidth + ((this.spawnCursor * 1.37) % width),
            z: this.config.spawnZ + (this.spawnCursor % 3) * 0.6,
            hp: this.config.gruntHp,
            state: 'alive',
            stateTimer: 0,
            hitCount: 0,
        });
        this.nextId += 1;
    }

    private spawnFinalHorde(): void {
        for (let i = 0; i < this.config.enemyCount; i += 1) {
            this.spawnGrunt();
        }
        for (let i = 0; i < this.config.bossCount; i += 1) {
            this.enemies.push({
                id: this.nextId,
                kind: 'boss',
                maxHp: this.config.bossHp,
                x: (i - (this.config.bossCount - 1) / 2) * 2.4,
                z: this.config.spawnZ + 1.8,
                hp: this.config.bossHp,
                state: 'alive',
                stateTimer: 0,
                hitCount: 0,
            });
            this.nextId += 1;
        }
    }
}
