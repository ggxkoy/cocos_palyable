// Design-doc knobs for the collect-upgrade template. An agent翻译策划案时只改这里：
// 文案、经济数值、演出开关、CTA 链接。布局坐标在 GoldRushView 顶部的常量表。
// 当前实例：docs/design/idle-zombie-miner.md（放置采矿主题）。
export const GOLD_RUSH_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        collect: 'Tap the gold piles',
        upgrade: 'Hire the zombie crew',
        battle: 'Zombies are digging!',
        end: 'Gold rush unlocked',
        upgradeTitle: 'HIRE',
        upgradeSub: 'Spend 75 gold',
        winTitle: 'GOLD RUSH!',
        winSubtitle: 'Your mine is booming',
        cta: 'PLAY NOW',
        baseLabelPrefix: 'Camp Lv.',
    },
    crateReward: 25,
    upgradeCost: 75,
    battleSpeed: 0.28,
    // 原片是纯生产演出：无敌人层，开采期金币持续喷涌。
    showEnemies: false,
    battleCoinBursts: true,
    battleCoinBurstInterval: 0.55,
} as const;
