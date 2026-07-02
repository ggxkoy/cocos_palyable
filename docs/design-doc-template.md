# Playable 策划案：{名称}

> 由 `/video-to-design` 从参考视频解析生成，交给 `/design-to-playable` 在 Cocos 工程中落地。
> 「模板类型」决定复用哪套代码；「数值配置」「文案清单」直接映射到对应模板的 `Config.ts`。

## 元信息

| 字段 | 值 |
| --- | --- |
| 案例来源 | {视频文件名 / 链接} |
| 分析日期 | {YYYY-MM-DD} |
| 视频时长 | {秒} |
| 模板类型 | {collect-upgrade \| towerdefense \| merge \| match3 \| runner \| custom} |
| 对应场景 | {maingame \| towerdefense \| merge \| match3 \| runner} |
| 屏幕方向 | 竖屏 720x1280 |
| 推广产品 | {游戏名} |
| CTA 链接 | {store / onelink URL} |

## 玩法概述

{一两句话说清核心循环：玩家做什么 → 得到什么反馈 → 如何导向 CTA}

## 流程分解（时间轴）

| 时间段 | 阶段 | 玩家操作 | 画面反馈 | 备注 |
| --- | --- | --- | --- | --- |
| 0:00-0:03 | {引导} | {点击箱子} | {金币飞行+手指提示} | |
| ... | | | | |

## 交互与引导

- 手指引导：{出现时机、指向目标、循环动画描述}
- 容错处理：{点错/不点时的表现，是否有超时自动演示}
- 胜利条件：{...}
- 失败条件：{... / 无失败}
- 结算卡：{出现时机、标题文案、CTA 按钮文案}

## 数值配置（映射 `assets/scripts/{template}/{Template}Config.ts`）

| 配置项 | 值 | 视频依据 |
| --- | --- | --- |
| {targetLevel / moves / duration ...} | {值} | {第 X 秒观察到...} |

## 文案清单（映射 Config 的 `texts` 字段）

| 字段 | 文案 |
| --- | --- |
| hudMessage | {...} |
| winTitle | {...} |
| cta | {...} |

## 美术资产清单（映射 `{Template}Game` 组件的 SpriteFrame 槽位）

| 槽位 | 视频中的资产描述 | 参考帧 | 尺寸建议(px) |
| --- | --- | --- | --- |
| backgroundFrame | {场景背景描述} | {frame_012.png} | 720x1280 |
| ... | | | |

## 音效清单（可选，模板暂不接入）

| 时机 | 描述 |
| --- | --- |

## 与模板的差异点

> 模板覆盖不到、需要额外写代码的部分。`/design-to-playable` 会按此列表修改对应 View/Model。

1. {例：升级有两级而非一级}
2. {例：结算卡带倒计时}
