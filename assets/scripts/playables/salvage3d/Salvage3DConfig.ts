// 3D 模块化实例：废土打捞防线（docs/design/army-salvage-defense.md）。
// 世界坐标为米（XZ 平面，+x 右，-z 远/画面上方），相机等距斜视并跟随主角。
// 大地图分三屏（各约一个画面高），沿 z 轴排布：
//   北（z≈-13）采集区：敲残骸掉金子/木材；大飞机锚点在最深处（z≈-17.5）
//   中（z≈0）  转换区：回收站换金币弹药、雇佣目标牌、出生点
//   南（z≈+13）防守区：炮塔防线抵御丧尸渗透波与终局敌潮
// 拼接新 playable = 换一份这样的配置 + 挑选模块清单（见 Salvage3DGame）。
export const SALVAGE3D_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        guide: 'Hold & drag to move',
        manage: 'Arm the defense line',
        boom: 'Full firepower online!',
        end: 'Defense line secured',
        winTitle: 'DEFENSE ONLINE!',
        winSubtitle: 'Scrap wins wars',
        cta: 'PLAY NOW',
        hireLabel: 'HIRE',
        unlockLabel: 'OPEN',
        vaultLabel: 'SALVAGE',
        nextPrefix: 'NEXT ',
        ammoPrefix: 'AMMO ',
    },
    world: {
        ground: { width: 11, length: 44 },
        zones: [
            { id: 1, x: -2.4, z: -13, yieldKind: 'gold' },
            { id: 2, x: 2.4, z: -13, yieldKind: 'wood' },
        ],
        veinOffsets: [
            { x: -0.9, z: -0.2 },
            { x: 0.2, z: -0.9 },
            { x: 0.8, z: 0.5 },
        ],
        depot: { x: 0, z: 0 },
        avatarSpawn: { x: 0, z: 3 },
        vault: { x: 0, z: -17.5 },
        turrets: [
            { x: -1.9, z: 12.5 },
            { x: 1.9, z: 12.5 },
        ],
        hordeSpawnZ: 20.5,
        hordeLineZ: 13.6,
    },
    // 目标链：严格按顺序；最后一环打捞大飞机（vault，采集区最深处），
    // 由玩家亲手走上去触发防线演出结算。
    purchases: [
        { id: 'hire1', kind: 'hire', cost: 15, x: -2, z: 2.6 },
        { id: 'zone2', kind: 'unlock', cost: 30, x: 2, z: 2.6 },
        { id: 'hire2', kind: 'hire', cost: 45, x: -2, z: 2.6 },
        { id: 'vault', kind: 'vault', cost: 80, x: 0, z: -17.5 },
    ],
    padRadius: 1.0,
    vaultRadius: 2.0,
    // 站上目标牌驻留购买（摇杆操控下的消费方式）。
    dwellTime: 0.45,
    avatarSpeed: 4.6,
    workerSpeed: 4.4,
    capacity: 5,
    strikeInterval: 0.26,
    veinStock: 6,
    veinRespawn: 2.2,
    depositTime: 0.3,
    depositRange: 1.6,
    actionRange: 1.0,
    detectRange: 9,
    // 掉落物：类型决定价值与表现（金子/木材…），走近自动背上。
    pickups: {
        pickupRange: 1.35,
        valueByKind: { gold: 5, wood: 3 } as Record<string, number>,
    },
    // 主角战斗：范围内最近敌人按距离选近战/远程。
    avatarCombat: {
        meleeRange: 1.3,
        rangedRange: 4.5,
        attackInterval: 0.4,
        attackDamage: 1,
    },
    // 动画状态机 → FBX 剪辑名映射（01_主角的动画文件；名字按编辑器导入结果调整）。
    animClips: {
        idle: 'idle1',
        walk: 'walk1',
        collect: 'idle2',
        strike: 'idle3',
        melee: 'idle4',
        ranged: 'talk',
        deposit: 'idle2',
    } as Record<string, string>,
    boomDuration: 5.4,
    defense: {
        enemyCount: 24,
        enemySpeed: 2.2,
        // 对标案规则：BOSS 数量少、血厚、移动慢，炮塔优先攻击 BOSS。
        bossCount: 1,
        bossHp: 12,
        bossSpeed: 1.1,
        fireInterval: 0.12,
        // 渗透波：首次雇佣后小股丧尸持续压线（中期压力）。
        trickleInterval: 6.5,
        trickleCount: 2,
        ammoPerItem: 2,
        ammoCap: 80,
    },
    camera: {
        // 跟随主角的等距机位：offset 相对主角，damp 越大跟得越紧。
        offset: { x: 0, y: 12.5, z: 11.5 },
        lookOffset: { x: 0, y: 0, z: -0.8 },
        followDamp: 6,
        fov: 45,
    },
} as const;

export type Salvage3DConfig = typeof SALVAGE3D_CONFIG;
