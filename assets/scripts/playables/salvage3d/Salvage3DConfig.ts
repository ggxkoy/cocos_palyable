// 3D 模块化实例：废土打捞防线（docs/design/army-salvage-defense.md）。
// 世界坐标为米（XZ 平面，+x 右，-z 远/画面上方），相机等距斜视并跟随主角。
// 大地图分三屏：北=泥潭打捞区（绳子够不着的深处沉着大件），中=回收转换区，南=丧尸防线。
//
// 核心经济循环（拉绳打捞版）：
//   拉绳捞残骸 → 回收站【废料换子弹】（等级越高的废料换的子弹越多）
//   → 炮塔杀丧尸 →【只有杀敌掉金币】→ 金币升级绳子（长度+质量）
//   → 够得着更深处更高级的残骸 → 更多子弹 → 杀更多敌 → …
// 初始绳子只能拉一级小件；大飞机（终极目标）需要满级绳子才能捞。
export const SALVAGE3D_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        guide: 'Hold & drag to move',
        manage: 'Arm the defense line',
        boom: 'Full firepower online!',
        end: 'Defense line secured',
        winTitle: 'DEFENSE ONLINE!',
        winSubtitle: 'Scrap wins wars',
        failTitle: 'WALL BREACHED!',
        failSubtitle: 'The horde broke through',
        retryLabel: 'REVIVE WALL',
        cta: 'PLAY NOW',
        hireLabel: 'HIRE',
        unlockLabel: 'ROPE+',
        vaultLabel: 'SALVAGE',
        nextPrefix: 'NEXT ',
        ammoPrefix: 'AMMO ',
    },
    world: {
        ground: { width: 11, length: 44 },
        // 泥潭（不可通行，只能用绳子够）：从岸线向北。
        swamp: { shoreZ: -9.4, centerZ: -14, length: 9.4 },
        depot: { x: 0, z: 0 },
        avatarSpawn: { x: 0, z: 3 },
        // 大飞机残骸（视觉锚点）沉在泥潭最深处；打捞点（vault 牌）在岸边。
        vault: { x: 0, z: -17.5 },
        workerRally: { x: 0, z: -8 },
        turrets: [
            { x: -1.9, z: 12.5 },
            { x: 1.9, z: 12.5 },
        ],
        hordeSpawnZ: 20.5,
        hordeLineZ: 13.6,
    },
    // 打捞绳：等级决定长度（够多深）与质量（拉得动几级）。升级只花金币。
    rope: {
        ranges: [2.6, 5.0, 7.8],
        respawnTime: 4,
        tierSpecs: [
            { tier: 1, pullTime: 1.1, scrapKind: 'scrap1', scrapCount: 2 },
            { tier: 2, pullTime: 1.9, scrapKind: 'scrap2', scrapCount: 3 },
            { tier: 3, pullTime: 2.8, scrapKind: 'scrap3', scrapCount: 4 },
        ],
        // 小件浅处、大件深处：绳子不够长物理上就够不着。
        wrecks: [
            { tier: 1, x: -1.8, z: -10.6 },
            { tier: 1, x: 0.2, z: -11.0 },
            { tier: 1, x: 2.0, z: -10.7 },
            { tier: 1, x: -0.9, z: -11.4 },
            { tier: 2, x: -2.2, z: -13.4 },
            { tier: 2, x: 0.8, z: -13.8 },
            { tier: 2, x: 2.6, z: -13.2 },
            { tier: 3, x: -1.2, z: -15.9 },
            { tier: 3, x: 1.6, z: -16.3 },
        ],
    },
    // 目标牌（非线性，价格引导顺序）：雇佣与绳子升级都花金币（金币只来自杀敌）。
    // vault=在岸边拉大飞机，需要满级绳子（attachRequirement 门槛）。
    purchases: [
        { id: 'hire1', kind: 'hire', cost: 15, x: -2, z: 2.6 },
        { id: 'rope2', kind: 'unlock', cost: 30, x: 2, z: 2.6 },
        { id: 'hire2', kind: 'hire', cost: 45, x: -2, z: 2.6 },
        { id: 'rope3', kind: 'unlock', cost: 60, x: 2, z: 2.6 },
        { id: 'vault', kind: 'vault', cost: 80, x: 0, z: -8.2 },
    ],
    padRadius: 1.0,
    vaultRadius: 1.4,
    dwellTime: 0.45,
    avatarSpeed: 4.6,
    workerSpeed: 4.4,
    capacity: 5,
    depositTime: 0.3,
    depositRange: 1.6,
    workSearchRange: 9,
    detectRange: 10,
    pickups: {
        pickupRange: 1.35,
        // 废料→子弹兑换率：越高级的物体换的子弹越多。
        ammoByKind: { scrap1: 3, scrap2: 5, scrap3: 8 } as Record<string, number>,
        // 金币面值（敌人掉落，拾取直接入账）。
        coinValue: 8,
    },
    avatarCombat: {
        meleeRange: 1.3,
        rangedRange: 4.5,
        attackInterval: 0.4,
        attackDamage: 1,
    },
    // 动画剪辑不在配置里写名字：真实 AnimationClip 资产由 views/ 下
    // 各 View 组件的槽位拖入（场景已按 UUID 预接好 01/06 的剪辑）。
    defense: {
        enemyCount: 18,
        enemySpeed: 2.2,
        gruntHp: 2,
        bossCount: 1,
        bossHp: 12,
        bossSpeed: 1.1,
        fireInterval: 0.12,
        bulletSpeed: 14,
        deathTime: 1.1,
        trickleInterval: 5.5,
        trickleCount: 3,
        ammoCap: 80,
        // 围墙：敌人抵墙改攻墙。对标案伤害关系——小兵挠 1、BOSS 砸 10；
        // 击破=失败，可复活重试 1 次。
        wall: {
            maxHp: 120,
            gruntDamage: 1,
            bossDamage: 10,
            attackInterval: 1.0,
        },
    },
    camera: {
        offset: { x: 0, y: 12.5, z: 11.5 },
        lookOffset: { x: 0, y: 0, z: -0.8 },
        followDamp: 6,
        fov: 45,
    },
} as const;

export type Salvage3DConfig = typeof SALVAGE3D_CONFIG;
