// Design-doc knobs for the behavior-tree crew template（自动化感知式经营）。
// An agent翻译策划案时只改这里：区域/矿脉布局、感知与攻击参数、经济、文案、CTA。
// 人物由 common/BehaviorTree.ts 驱动，大脑是感知式的：
// 「范围内发现目标 → 自动接近 → 自动攻击/开采 → 背负 → 满载回投」，
// 玩家只做雇佣/解锁（大循环）。战斗压力型案例把矿脉换成敌人（stock=血量）即可。
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
        zones: [
            { id: 1, x: 100, y: 330 },
            { id: 2, x: 290, y: 330 },
        ],
        // 每个区域内矿脉相对区域中心的偏移。
        veinOffsets: [
            { x: -38, y: -10 },
            { x: 10, y: -34 },
            { x: 34, y: 18 },
        ],
        depot: { x: 195, y: 585 },
        workerSpawn: { x: 195, y: 650 },
    },
    // 购买项按顺序引导：首个工人免费（引导期），之后雇工与解锁 2 号矿区。
    purchases: [
        { id: 'hire1', kind: 'hire', cost: 0, x: 120, y: 706 },
        { id: 'hire2', kind: 'hire', cost: 20, x: 120, y: 706 },
        { id: 'zone2', kind: 'unlock', cost: 40, x: 270, y: 706 },
    ],
    startGold: 0,
    workerSpeed: 150,
    workerCapacity: 3,
    // 感知与自动开采：探测半径内锁定最近目标，进入攻击距离后按间隔敲击。
    detectRange: 300,
    actionRange: 36,
    strikeInterval: 0.28,
    yieldPerStrike: 1,
    veinStock: 6,
    veinRespawn: 2.5,
    depositTime: 0.3,
    goldPerBar: 5,
    boomGoldTarget: 50,
    boomDuration: 2.6,
    boomBurstInterval: 0.4,
    // 安全上限：无论经营进度如何，到时长直接进入 boom 收尾。
    maxDuration: 30,
} as const;
