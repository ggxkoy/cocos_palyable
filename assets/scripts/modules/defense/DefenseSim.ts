import { EventBus } from '../../framework/EventBus';
import { EconomySim } from '../economy/EconomySim';

// 敌潮防御模块（纯逻辑）：监听 goal:vault 触发演出——红色敌潮向防线推进，
// 炮塔按射速轮流点名最近威胁，消耗弹药。纯演出，无失败路径。
export interface DefenseConfig {
    readonly turrets: ReadonlyArray<{ readonly x: number; readonly z: number }>;
    readonly enemyCount: number;
    readonly enemySpeed: number;
    readonly fireInterval: number;
    readonly spawnZ: number;
    readonly lineZ: number;
    readonly fieldHalfWidth: number;
}

export interface DefenseEnemy {
    readonly id: number;
    x: number;
    z: number;
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
                enemy.z = Math.max(this.config.lineZ, enemy.z - this.config.enemySpeed * deltaTime);
            }
        }

        this.fireTimer -= deltaTime;
        while (this.fireTimer <= 0) {
            let target: DefenseEnemy | null = null;
            for (const enemy of this.enemies) {
                if (enemy.alive && (!target || enemy.z < target.z)) {
                    target = enemy;
                }
            }
            if (!target) {
                this.fireTimer = 0;
                this.active = false;
                break;
            }
            const turret = this.config.turrets[this.turretIndex % this.config.turrets.length];
            this.turretIndex += 1;
            target.alive = false;
            this.economy.consumeAmmo(1);
            const fire: DefenseFire = { fromX: turret.x, fromZ: turret.z, toX: target.x, toZ: target.z };
            this.bus.emit('fx:fire', fire);
            this.fireTimer += this.config.fireInterval;
        }
    }

    private spawnHorde(): void {
        const width = this.config.fieldHalfWidth * 2;
        for (let i = 0; i < this.config.enemyCount; i += 1) {
            this.enemies.push({
                id: this.nextId,
                x: -this.config.fieldHalfWidth + ((i * 1.37) % width),
                z: this.config.spawnZ + (i % 4) * 0.7,
                alive: true,
            });
            this.nextId += 1;
        }
        this.active = true;
    }
}
