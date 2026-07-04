// Design-doc knobs for the behavior-tree crew template（自动化感知式经营）。
// 当前实例：docs/design/army-salvage-defense.md（废土打捞防线）——
// veins=泥潭残骸、depot=回收站、workers=工兵、vault=大飞机残骸（终极打捞）。
// An agent翻译策划案时只改这里：区域/矿脉布局、感知与攻击参数、经济、文案、CTA。
// 操作归属：主角移动由玩家点击驱动，不点就停在原地，绝无自动推进/自动结算；
// 主角只有「范围内自动交互」（挨着矿脉自动开采、挨着仓库自动投递）。
// 雇员是玩家花钱买来的自动化，由 common/BehaviorTree.ts 感知式大脑驱动：
// 「范围内发现目标 → 自动接近 → 自动开采 → 背负 → 满载回投」。
// 战斗压力型案例把矿脉换成敌人（stock=血量）即可。
// 坐标为 390x844 web 空间（见 common/Layout.ts）。
export const CREW_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        guide: 'Drag the wreck to recycle',
        manage: 'Arm the defense line',
        boom: 'Full firepower online!',
        end: 'Defense line secured',
        winTitle: 'DEFENSE ONLINE!',
        winSubtitle: 'Scrap wins wars',
        cta: 'PLAY NOW',
        hireLabel: 'HIRE',
        unlockLabel: 'OPEN',
        freeLabel: 'FREE',
        ammoPrefix: 'AMMO ',
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
        // 长期锚点：金库从第一帧就矗立在地图顶部，是整局的终极目标；
        // 角色高约 34（画面高 844 的 4%），地图纵向足够摆下「金库-矿区-仓库-操作区」四层。
        vault: { x: 195, y: 150 },
    },
    // 目标链：每完成一个购买，下一个目标已经在场上（牌子/锁定建筑开局全部可见），
    // 严格按顺序解锁；最后一环是打捞大飞机（vault），由玩家亲手点开触发防线演出结算。
    // 主角先手动捞一趟（15 金）即可雇佣第一个自动化工兵；价格牌 30 为原片观察值。
    purchases: [
        { id: 'hire1', kind: 'hire', cost: 15, x: 120, y: 706 },
        { id: 'zone2', kind: 'unlock', cost: 30, x: 270, y: 706 },
        { id: 'hire2', kind: 'hire', cost: 45, x: 120, y: 706 },
        { id: 'vault', kind: 'vault', cost: 80, x: 195, y: 236 },
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
    boomDuration: 3.4,
    boomBurstInterval: 0.4,
    // 敌潮防御演出（策划案差异点 #1/#2）：打捞完成后红色敌潮从下方涌来，
    // 炮塔按射速逐个点名击倒（火力兑现时刻）；弹药计数随入库上涨、随射击消耗，
    // 纯演出无失败路径。弹药上限 30→80 为原片观察值。
    defense: {
        turrets: [
            { x: 120, y: 640 },
            { x: 270, y: 640 },
        ],
        enemyCount: 24,
        enemySpeed: 90,
        spawnY: 830,
        lineY: 700,
        fireInterval: 0.12,
        ammoPerBar: 2,
        ammoCap: 80,
    },
} as const;
