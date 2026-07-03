import { TOWER_DEFENSE_CONFIG } from './TowerDefenseConfig';
import { LaneEnemy, PlayableState, Projectile, TowerSlot } from './TowerDefenseTypes';

const CONFIG = TOWER_DEFENSE_CONFIG;

export class TowerDefenseModel {
    public state: PlayableState = PlayableState.Ready;
    public coins: number = CONFIG.startCoins;
    public baseHealth: number = CONFIG.baseHealth;
    public elapsed: number = 0;
    public spawnTimer: number = CONFIG.firstSpawnDelay;
    public nextEnemyId: number = 1;
    public nextProjectileId: number = 1;
    public readonly enemies: LaneEnemy[] = [];
    public readonly projectiles: Projectile[] = [];
    public readonly slots: TowerSlot[] = [
        { id: 1, occupied: false, cooldown: 0 },
        { id: 2, occupied: false, cooldown: 0 },
        { id: 3, occupied: false, cooldown: 0 },
    ];

    public start(): void {
        this.state = PlayableState.Running;
    }

    public buildTower(slotId: number): boolean {
        const slot = this.slots.find(item => item.id === slotId);
        if (!slot || slot.occupied || this.coins <= 0 || this.state !== PlayableState.Running) {
            return false;
        }

        slot.occupied = true;
        this.coins -= 1;
        return true;
    }

    public update(deltaTime: number): void {
        if (this.state !== PlayableState.Running) {
            return;
        }

        this.elapsed += deltaTime;
        this.spawnTimer -= deltaTime;
        this.updateSpawning();
        this.updateEnemies(deltaTime);
        this.updateTowers(deltaTime);
        this.updateProjectiles(deltaTime);
        this.resolveEndState();
    }

    private updateSpawning(): void {
        if (this.spawnTimer > 0 || this.elapsed > CONFIG.spawnWindow) {
            return;
        }

        this.spawnTimer = Math.max(CONFIG.spawnIntervalMin, CONFIG.spawnIntervalMax - this.elapsed * CONFIG.spawnIntervalRamp);
        this.enemies.push({
            id: this.nextEnemyId,
            progress: 0,
            health: CONFIG.enemyHealth,
            maxHealth: CONFIG.enemyHealth,
            speed: CONFIG.enemyBaseSpeed + Math.min(this.elapsed * CONFIG.enemySpeedRamp, CONFIG.enemySpeedCap),
        });
        this.nextEnemyId += 1;
    }

    private updateEnemies(deltaTime: number): void {
        this.enemies.forEach(enemy => {
            enemy.progress += enemy.speed * deltaTime;
        });

        const escaped = this.enemies.filter(enemy => enemy.progress >= 1).length;
        if (escaped > 0) {
            this.baseHealth = Math.max(0, this.baseHealth - escaped);
        }

        this.removeEnemies(enemy => enemy.progress >= 1);
    }

    private updateTowers(deltaTime: number): void {
        this.slots.filter(slot => slot.occupied).forEach(slot => {
            slot.cooldown = Math.max(0, slot.cooldown - deltaTime);
            if (slot.cooldown > 0) {
                return;
            }

            const target = this.enemies
                .filter(enemy => enemy.progress > 0.08 && enemy.progress < 0.95)
                .sort((a, b) => b.progress - a.progress)[0];

            if (!target) {
                return;
            }

            slot.cooldown = CONFIG.towerCooldown;
            target.health -= CONFIG.towerDamage;
            this.projectiles.push({
                id: this.nextProjectileId,
                slotId: slot.id,
                targetProgress: target.progress,
                lifetime: 0.22,
            });
            this.nextProjectileId += 1;

            if (target.health <= 0) {
                this.coins += CONFIG.killReward;
            }
        });

        this.removeEnemies(enemy => enemy.health <= 0);
    }

    private updateProjectiles(deltaTime: number): void {
        this.projectiles.forEach(projectile => {
            projectile.lifetime -= deltaTime;
        });

        for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
            if (this.projectiles[index].lifetime <= 0) {
                this.projectiles.splice(index, 1);
            }
        }
    }

    private resolveEndState(): void {
        if (this.baseHealth <= 0) {
            this.state = PlayableState.Failed;
            return;
        }

        if (this.elapsed >= CONFIG.winTime && this.enemies.length === 0) {
            this.state = PlayableState.Won;
        }
    }

    private removeEnemies(predicate: (enemy: LaneEnemy) => boolean): void {
        for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
            if (predicate(this.enemies[index])) {
                this.enemies.splice(index, 1);
            }
        }
    }
}
