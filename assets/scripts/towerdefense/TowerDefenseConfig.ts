// Design-doc knobs for the tower defense template. An agent翻译策划案时只改这里：
// 文案、经济数值、节奏参数、CTA 链接。布局坐标在 TowerDefenseView 顶部的常量表。
export const TOWER_DEFENSE_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        hudMessage: 'Build Towers',
        winTitle: 'Victory',
        failTitle: 'Try Again',
        subtitle: 'Upgrade your defense',
        cta: 'PLAY NOW',
    },
    startCoins: 3,
    baseHealth: 5,
    enemyHealth: 3,
    enemyBaseSpeed: 0.08,
    enemySpeedRamp: 0.002,
    enemySpeedCap: 0.08,
    spawnWindow: 20,
    winTime: 24,
    firstSpawnDelay: 0,
    spawnIntervalMax: 2.2,
    spawnIntervalMin: 0.8,
    spawnIntervalRamp: 0.05,
    towerCooldown: 0.55,
    towerDamage: 1,
    killReward: 1,
} as const;
