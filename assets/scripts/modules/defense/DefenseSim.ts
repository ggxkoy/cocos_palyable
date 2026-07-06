import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';

// 敌潮防御模块（纯逻辑）：监听 goal:vault 触发演出——红色敌潮向防线推进，
// 炮塔按射速点名目标，消耗弹药。对标案规则：BOSS 数量少、血厚、移动慢，
// 炮塔【优先攻击 BOSS】，其次是离防线最近的小兵。纯演出，无失败路径。
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
    public active = false;

    private fireTimer = 0;
    private turretIndex = 0;
    private nextId = 1;

    constructor(
        private readonly config: DefenseConfig,
        private readonly economy: EconomySim,
        private readonly bus: EventBus,
    ) {
        bus.on('goal:vault', () => this.spawnHorde());
    }

    public tick(deltaTime: number): void {
        if (!this.active) {
            return;
        }

        for (const enemy of this.enemies) {
            if (enemy.alive) {
                const speed = enemy.kind === 'boss' ? this.config.bossSpeed : this.config.enemySpeed;
                enemy.z = Math.max(this.config.lineZ, enemy.z - speed * deltaTime);
            }
        }

        this.fireTimer -= deltaTime;
        while (this.fireTimer <= 0) {
            const target = this.pickTarget();
            if (!target) {
                this.fireTimer = 0;
                this.active = false;
                break;
            }
            const turret = this.config.turrets[this.turretIndex % this.config.turrets.length];
            this.turretIndex += 1;
            target.hp -= 1;
            if (target.hp <= 0) {
                target.alive = false;
            }
            this.economy.consumeAmmo(1);
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

    private spawnHorde(): void {
        const width = this.config.fieldHalfWidth * 2;
        for (let i = 0; i < this.config.enemyCount; i += 1) {
            this.enemies.push({
                id: this.nextId,
                kind: 'grunt',
                x: -this.config.fieldHalfWidth + ((i * 1.37) % width),
                z: this.config.spawnZ + (i % 4) * 0.7,
                hp: 1,
                alive: true,
            });
            this.nextId += 1;
        }
        for (let i = 0; i < this.config.bossCount; i += 1) {
            this.enemies.push({
                id: this.nextId,
                kind: 'boss',
                x: (i - (this.config.bossCount - 1) / 2) * 2.4,
                z: this.config.spawnZ + 1.6,
                hp: this.config.bossHp,
                alive: true,
            });
            this.nextId += 1;
        }
        this.active = true;
    }
}
