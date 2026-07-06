// 3D 模块化实例：废土打捞防线（docs/design/army-salvage-defense.md）。
// 世界坐标为米（XZ 平面，+x 右，-z 远/画面上方），相机为等距斜视。
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
        ground: { width: 10.5, length: 22 },
        zones: [
            { id: 1, x: -2.4, z: -3.4 },
            { id: 2, x: 2.4, z: -3.4 },
        ],
        veinOffsets: [
            { x: -0.9, z: -0.2 },
            { x: 0.2, z: -0.9 },
            { x: 0.8, z: 0.5 },
        ],
        depot: { x: 0, z: 2.6 },
        avatarSpawn: { x: 0, z: 4.2 },
        vault: { x: 0, z: -6.4 },
        turrets: [
            { x: -1.9, z: 4.6 },
            { x: 1.9, z: 4.6 },
        ],
        hordeSpawnZ: 9.4,
        hordeLineZ: 5.8,
    },
    // 目标链：严格按顺序；最后一环打捞大飞机（vault）触发防线演出结算。
    purchases: [
        { id: 'hire1', kind: 'hire', cost: 15, x: -1.9, z: 5.8 },
        { id: 'zone2', kind: 'unlock', cost: 30, x: 1.9, z: 5.8 },
        { id: 'hire2', kind: 'hire', cost: 45, x: -1.9, z: 5.8 },
        { id: 'vault', kind: 'vault', cost: 80, x: 0, z: -6.4 },
    ],
    padRadius: 1.0,
    vaultRadius: 1.8,
    // 站上目标牌驻留购买（摇杆操控下的消费方式，替代点击）。
    dwellTime: 0.45,
    avatarSpeed: 3.8,
    workerSpeed: 3.4,
    capacity: 3,
    strikeInterval: 0.28,
    yieldPerStrike: 1,
    veinStock: 6,
    veinRespawn: 2.5,
    depositTime: 0.3,
    depositRange: 1.5,
    actionRange: 0.9,
    detectRange: 8,
    goldPerBar: 5,
    // 演出时长要覆盖：小兵 24 发 + BOSS 12 发 ≈ 4.3s 射击。
    boomDuration: 5.4,
    defense: {
        enemyCount: 24,
        enemySpeed: 2.2,
        // 对标案规则：BOSS 数量少、血厚、移动慢，炮塔优先攻击 BOSS。
        bossCount: 1,
        bossHp: 12,
        bossSpeed: 1.1,
        fireInterval: 0.12,
        ammoPerBar: 2,
        ammoCap: 80,
    },
    camera: {
        position: { x: 0, y: 12.5, z: 11.5 },
        lookAt: { x: 0, y: 0, z: -0.8 },
        fov: 45,
    },
} as const;

export type Salvage3DConfig = typeof SALVAGE3D_CONFIG;
