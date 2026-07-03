// Design-doc knobs for the behavior-tree crew template（放置经营实例）。
// An agent翻译策划案时只改这里：站点布局、经济数值、节奏、文案、CTA。
// 人物由 common/BehaviorTree.ts 驱动：工人循环「采集→搬运→入库」（小循环），
// 玩家点击雇佣/解锁改变世界（大循环）。战斗压力型案例换一棵「索敌→接近→攻击」的树即可。
// 坐标为 390x844 web 空间（见 common/Layout.ts）。
export const CREW_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        guide: 'Hire your first miner',
        manage: 'Grow the gold camp',
        boom: 'The camp is booming!',
        end: 'Gold empire founded',
        winTitle: 'BOOMING!',
        winSubtitle: 'Your camp never sleeps',
        cta: 'PLAY NOW',
        hireLabel: 'HIRE',
        unlockLabel: 'OPEN',
        freeLabel: 'FREE',
    },
    stations: {
        mines: [
            { id: 1, x: 100, y: 330 },
            { id: 2, x: 290, y: 330 },
        ],
        depot: { x: 195, y: 585 },
        workerSpawn: { x: 195, y: 650 },
    },
    // 购买项按顺序引导：首个工人免费（引导期），之后雇工与解锁 2 号矿点。
    purchases: [
        { id: 'hire1', kind: 'hire', cost: 0, x: 120, y: 706 },
        { id: 'hire2', kind: 'hire', cost: 20, x: 120, y: 706 },
        { id: 'mine2', kind: 'unlock', cost: 40, x: 270, y: 706 },
    ],
    startGold: 0,
    workerSpeed: 150,
    workerCapacity: 3,
    harvestTimePerBar: 0.25,
    depositTime: 0.3,
    goldPerBar: 5,
    boomGoldTarget: 50,
    boomDuration: 2.6,
    boomBurstInterval: 0.4,
    // 安全上限：无论经营进度如何，到时长直接进入 boom 收尾。
    maxDuration: 30,
} as const;
