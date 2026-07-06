// 掉落物模块（纯逻辑）：类型化道具（金子/木材/…）散落在地面，
// 主角/雇员走近自动吸附背到身后。类型决定价值与表现（视觉层按 kind 换形）。
export interface Pickup {
    readonly id: number;
    readonly kind: string;
    readonly x: number;
    readonly z: number;
    alive: boolean;
}

export class PickupSim {
    public readonly pickups: Pickup[] = [];

    private nextId = 1;

    public spawn(kind: string, x: number, z: number): Pickup {
        const pickup: Pickup = { id: this.nextId, kind, x, z, alive: true };
        this.nextId += 1;
        this.pickups.push(pickup);
        // 场上残留上限，防止无限堆积（旧的先消失）。
        const alive = this.pickups.filter(item => item.alive);
        if (alive.length > 60) {
            alive[0].alive = false;
        }
        return pickup;
    }

    public nearestAlive(x: number, z: number, range: number): Pickup | null {
        let best: Pickup | null = null;
        let bestDistance = range;
        for (const pickup of this.pickups) {
            if (!pickup.alive) {
                continue;
            }
            const distance = Math.hypot(pickup.x - x, pickup.z - z);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = pickup;
            }
        }
        return best;
    }

    public collect(pickup: Pickup): string {
        pickup.alive = false;
        return pickup.kind;
    }
}
