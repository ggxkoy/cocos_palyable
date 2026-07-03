import { RUNNER_CONFIG } from './RunnerConfig';
import { LaneIndex, RoadItem, RunnerPhase } from './RunnerTypes';

const CONFIG = RUNNER_CONFIG;
const LANES: readonly LaneIndex[] = [-1, 0, 1];

export class RunnerModel {
    public phase: RunnerPhase = RunnerPhase.Running;
    public playerLane: LaneIndex = 0;
    public coins = 0;
    public elapsed = 0;
    public readonly items: RoadItem[] = [];

    private spawnTimer = 0.6;
    private nextId = 1;

    public get timeLeft(): number {
        return Math.max(0, CONFIG.duration - this.elapsed);
    }

    public switchLane(direction: -1 | 1): boolean {
        if (this.phase !== RunnerPhase.Running) {
            return false;
        }
        const next = this.playerLane + direction;
        if (next < -1 || next > 1) {
            return false;
        }
        this.playerLane = next as LaneIndex;
        return true;
    }

    public update(deltaTime: number): void {
        if (this.phase !== RunnerPhase.Running) {
            return;
        }

        this.elapsed += deltaTime;
        if (this.elapsed >= CONFIG.duration) {
            this.phase = RunnerPhase.Won;
            return;
        }

        this.spawnTimer -= deltaTime;
        // Stop spawning near the end so the last wave clears before the finish.
        if (this.spawnTimer <= 0 && this.elapsed < CONFIG.duration - 2.5) {
            this.spawnTimer = CONFIG.spawnInterval;
            this.spawnWave();
        }

        for (const item of this.items) {
            item.progress += CONFIG.itemSpeed * deltaTime;
        }

        for (let index = this.items.length - 1; index >= 0; index -= 1) {
            const item = this.items[index];
            if (item.progress > 1.1) {
                this.items.splice(index, 1);
                continue;
            }
            if (item.lane !== this.playerLane) {
                continue;
            }
            if (item.progress < CONFIG.playerZoneMin || item.progress > CONFIG.playerZoneMax) {
                continue;
            }
            if (item.kind === 'coin') {
                this.coins += 1;
                this.items.splice(index, 1);
            } else {
                this.phase = RunnerPhase.Failed;
                return;
            }
        }
    }

    private spawnWave(): void {
        const shuffled = [...LANES].sort(() => Math.random() - 0.5);
        const obstacleCount = Math.random() < CONFIG.doubleObstacleChance ? 2 : 1;

        for (let i = 0; i < obstacleCount; i += 1) {
            this.items.push({ id: this.nextId, lane: shuffled[i], kind: 'obstacle', progress: 0 });
            this.nextId += 1;
        }

        if (Math.random() < CONFIG.coinChance) {
            const lane = shuffled[obstacleCount];
            for (let i = 0; i < CONFIG.coinRunLength; i += 1) {
                this.items.push({ id: this.nextId, lane, kind: 'coin', progress: -i * CONFIG.coinRunSpacing });
                this.nextId += 1;
            }
        }
    }
}
