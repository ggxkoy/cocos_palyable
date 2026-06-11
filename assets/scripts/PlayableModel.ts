import { LaneEnemy, PlayableState, Projectile, TowerSlot } from './GameTypes';

export class PlayableModel {
    public state: PlayableState = PlayableState.Ready;
    public coins: number = 3;
    public baseHealth: number = 5;
    public elapsed: number = 0;
    public spawnTimer: number = 0;
    public nextEnemyId: number = 1;
    public readonly enemies: LaneEnemy[] = [];
    public readonly projectiles: Projectile[] = [];
    public readonly slots: TowerSlot[] = [
        { id: 1, x: -120, y: -70, occupied: false, cooldown: 0 },
        { id: 2, x: 0, y: -15, occupied: false, cooldown: 0 },
        { id: 3, x: 120, y: -70, occupied: false, cooldown: 0 },
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
        if (this.spawnTimer > 0 || this.elapsed > 20) {
            return;
        }

        this.spawnTimer = Math.max(0.8, 2.2 - this.elapsed * 0.05);
        this.enemies.push({
            id: this.nextEnemyId,
            progress: 0,
            health: 3,
            maxHealth: 3,
            speed: 0.08 + Math.min(this.elapsed * 0.002, 0.08),
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

            slot.cooldown = 0.55;
            target.health -= 1;
            this.projectiles.push({
                x: slot.x,
                y: slot.y,
                targetId: target.id,
                lifetime: 0.22,
            });

            if (target.health <= 0) {
                this.coins += 1;
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

        if (this.elapsed >= 24 && this.enemies.length === 0) {
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
