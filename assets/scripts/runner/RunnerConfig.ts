// Design-doc knobs for the lane-runner template. An agent翻译策划案时只改这里：
// 文案、时长节奏、生成规则、CTA 链接。布局坐标在 RunnerView 顶部的常量表。
export const RUNNER_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        hudMessage: 'Tap left / right to dodge',
        scorePrefix: 'Coins ',
        timePrefix: 'Time ',
        winTitle: 'FINISH!',
        failTitle: 'CRASH!',
        subtitle: 'Dodge the trains, grab the gold',
        cta: 'PLAY NOW',
    },
    duration: 18,
    spawnInterval: 0.85,
    itemSpeed: 0.55,
    coinChance: 0.9,
    doubleObstacleChance: 0.35,
    // Coins stream in as a run of N in the same lane (classic runner coin
    // lines), spaced by this much progress between consecutive coins.
    coinRunLength: 3,
    coinRunSpacing: 0.07,
    playerZoneMin: 0.82,
    playerZoneMax: 0.94,
} as const;
