// Design-doc knobs for the drag-merge template. An agent翻译策划案时只改这里：
// 文案、棋盘尺寸、初始布局、目标等级、CTA 链接。布局坐标在 MergeView 顶部的常量表。
export const MERGE_CONFIG = {
    ctaUrl: 'https://lastwar.onelink.me/PXmq/playable',
    texts: {
        hudMessage: 'Drag matching items together',
        progressPrefix: 'Best Lv.',
        winTitle: 'MAX LEVEL!',
        subtitle: 'Forge the ultimate gear',
        cta: 'PLAY NOW',
        levelPrefix: 'Lv.',
    },
    columns: 3,
    rows: 3,
    targetLevel: 4,
    // Row-major initial board, 0 = empty cell. Four Lv1 plus one Lv2 and one
    // Lv3 chain up to the target level in exactly four guided merges.
    initialLevels: [1, 0, 1, 2, 3, 1, 0, 1, 0],
} as const;
