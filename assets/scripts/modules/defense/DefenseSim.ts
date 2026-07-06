import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';
import { EnemyContact } from '../avatar/AvatarSim';

// 敌潮防御模块（纯逻辑）：
// - 渗透波：首次雇佣后，小股丧尸持续从南侧涌向防线（中期压力，对标视频 0:09 起）；
// - 终局潮：打捞大飞机触发大规模敌潮 + BOSS（数量少、血厚、移动慢）；
// - 炮塔按射速点名（优先 BOSS，其次离防线最近），【每发消耗弹药，没弹药就停火】——
//   弹药见底、敌人压线就是参考片里的危机感；
// - 敌人死亡向后倒地掉金币（bus 'enemy:down'，由拼装层接到掉落物模块）。
export interface DefenseConfig {
    readonly turrets: ReadonlyArray<{ readonly x: number; readonly z: number }>;
    readonly enemyCount: number;
    readonly enemySpeed: number;
    readonly bossCount: number;
    readonly bossHp: number;
    readonly bossSpeed: number;
    readonly fireInterval: number;
    readonly spawnZ: number;
    readonly lineZ: number;
    readonly fieldHalfWidth: number;
    readonly trickleInterval: number;
    readonly trickleCount: number;
}

export type DefenseEnemyKind = 'grunt' | 'boss';

export interface DefenseEnemy {
    readonly id: number;
    readonly kind: DefenseEnemyKind;
    x: number;
    z: number;
    hp: number;
    alive: boolean;
}

export interface DefenseFire {
    readonly fromX: number;
    readonly fromZ: number;
    readonly toX: number;
    readonly toZ: number;
}

export class DefenseSim {
    public readonly enemies: DefenseEnemy[] = [];
    public trickleActive = false;

    private fireTimer = 0;
    private trickleTimer = 0;
    private turretIndex = 0;
    private nextId = 1;
    private spawnCursor = 0;

    constructor(
        private readonly config: DefenseConfig,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {
        bus.on('goal:vault', () => this.spawnFinalHorde());
    }

    // 首次雇佣后开启渗透波（拼装层接线）。
    public startTrickle(): void {
        this.trickleActive = true;
        this.trickleTimer = 0.8;
    }

    // 主角战斗用的感知查询。
    public nearestAlive(x: number, z: number, range: number): EnemyContact | null {
        let best: DefenseEnemy | null = null;
        let bestDistance = range;
        for (const enemy of this.enemies) {
            if (!enemy.alive) {
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

    public damage(enemyId: number, amount: number): boolean {
        const enemy = this.enemies.find(item => item.id === enemyId);
        if (!enemy || !enemy.alive) {
            return false;
        }
        enemy.hp -= amount;
        if (enemy.hp <= 0) {
            this.kill(enemy);
            return true;
        }
        return false;
    }

    public tick(deltaTime: number): void {
        if (this.trickleActive) {
            this.trickleTimer -= deltaTime;
            if (this.trickleTimer <= 0) {
                this.trickleTimer = this.config.trickleInterval;
                for (let i = 0; i < this.config.trickleCount; i += 1) {
                    this.spawnGrunt();
                }
            }
        }

        for (const enemy of this.enemies) {
            if (enemy.alive) {
                const speed = enemy.kind === 'boss' ? this.config.bossSpeed : this.config.enemySpeed;
                enemy.z = Math.max(this.config.lineZ, enemy.z - speed * deltaTime);
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
            target.hp -= 1;
            if (target.hp <= 0) {
                this.kill(target);
            }
            const fire: DefenseFire = { fromX: turret.x, fromZ: turret.z, toX: target.x, toZ: target.z };
            this.bus.emit('fx:fire', fire);
            this.fireTimer += this.config.fireInterval;
        }
    }

    // 优先 BOSS，其次离防线最近（z 最小）的小兵。
    private pickTarget(): DefenseEnemy | null {
        let boss: DefenseEnemy | null = null;
        let grunt: DefenseEnemy | null = null;
        for (const enemy of this.enemies) {
            if (!enemy.alive) {
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

    private kill(enemy: DefenseEnemy): void {
        enemy.alive = false;
        this.bus.emit('enemy:down', { x: enemy.x, z: enemy.z, kind: enemy.kind });
    }

    private spawnGrunt(): void {
        const width = this.config.fieldHalfWidth * 2;
        this.spawnCursor += 1;
        this.enemies.push({
            id: this.nextId,
            kind: 'grunt',
            x: -this.config.fieldHalfWidth + ((this.spawnCursor * 1.37) % width),
            z: this.config.spawnZ + (this.spawnCursor % 3) * 0.6,
            hp: 1,
            alive: true,
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
                x: (i - (this.config.bossCount - 1) / 2) * 2.4,
                z: this.config.spawnZ + 1.8,
                hp: this.config.bossHp,
                alive: true,
            });
            this.nextId += 1;
        }
    }
}
