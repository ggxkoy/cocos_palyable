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
        subtitle: 'Outrun the whole city',
        cta: 'PLAY NOW',
    },
    duration: 18,
    spawnInterval: 0.9,
    itemSpeed: 0.55,
    coinChance: 0.7,
    doubleObstacleChance: 0.35,
    playerZoneMin: 0.82,
    playerZoneMax: 0.94,
} as const;
