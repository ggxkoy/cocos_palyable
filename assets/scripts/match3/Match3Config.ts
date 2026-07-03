// Design-doc knobs for the match-3 template. An agent翻译策划案时只改这里：
// 文案、棋盘参数、目标分数与步数、CTA 链接。布局坐标在 Match3View 顶部的常量表。
export const MATCH3_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        hudMessage: 'Swap to match 3!',
        scorePrefix: 'Score ',
        movesPrefix: 'Moves ',
        winTitle: 'SWEET!',
        failTitle: 'So close!',
        subtitle: 'Play the full puzzle',
        cta: 'PLAY NOW',
    },
    columns: 6,
    rows: 6,
    gemColors: 5,
    moves: 10,
    targetScore: 300,
    pointsPerGem: 10,
    // Fixed seed keeps the opening board reproducible for tests and QA.
    seed: 20260702,
} as const;
