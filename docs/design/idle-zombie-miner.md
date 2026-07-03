# Playable 策划案：Idle Zombie Miner - Gold Rush（放置采矿）

> 由 `/video-to-design` 从参考视频解析生成，交给 `/design-to-playable` 在 Cocos 工程中落地。

## 元信息

| 字段 | 值 |
| --- | --- |
| 案例来源 | https://youtube.com/shorts/rmRuCgFaOMg（"Idle Zombie Miner Ads Review 488 - Gold Rush Begins"，57 秒竖屏 1080x1920） |
| 分析日期 | 2026-07-02 |
| 素材说明 | 本环境代理出口 IP 逐请求漂移，YouTube 媒体流全部 403，无法下载原片；分析基于官方故事板（57 帧 @1fps，50x90/帧放大）+ 高清封面帧。**帧内 UI 文字不可读**，涉及文案均为推断，已标注 |
| 模板类型 | collect-upgrade（gold 模板） |
| 对应场景 | maingame |
| 屏幕方向 | 竖屏 720x1280 |
| 推广产品 | Idle Zombie Miner（放置采矿/闲置经营） |
| CTA 链接 | 待广告主提供（保留模板默认占位） |

## 玩法概述

等距视角放置采矿：矿工在金矿盘敲出金条 → 背着金条跨过水桥送到托盘收集站 → 攒够金条解锁新站点并雇佣僵尸矿工 → 僵尸队伍自动开采、金条大量喷涌 → 展示完整基地收尾。playable 压缩为「点金堆收金 → 雇佣僵尸矿工 → 自动开采演出 → 结算 CTA」四阶段。

## 流程分解（时间轴，基于故事板帧号=秒）

| 时间段 | 阶段 | 玩家操作 | 画面反馈 | 备注 |
| --- | --- | --- | --- | --- |
| 0:00-0:04 | 开场 | 无 | 金矿盘特写，地面散落金条，矿工入场 | 对应模板 Collect 引导期 |
| 0:04-0:24 | 收集运送循环 | 控制矿工走位拾取 | 金条吸附上背、跨桥、倒进紫框托盘站（白/金条堆叠可见增长） | playable 简化为点击 3 处发光金堆 |
| 0:25-0:40 | 解锁与雇佣 | 走到黄色方格支付金条 | 新站点/传送带解锁（红白纹路站），僵尸矿工加入 | 对应 Upgrade：按钮消耗金币雇佣 |
| 0:41-0:52 | 自动开采爆发 | 无 | 僵尸+矿工围着金矿盘开采，金条喷涌铺满地面（frame 52-55 金色瀑布） | 对应 Battle 阶段改为「采矿演出」：无敌人，金币持续喷发 |
| 0:53-0:57 | 收尾 | 无 | 切到紫色调基地全景（建筑成型） | 对应 End：结算卡 + CTA |

## 交互与引导

- 手指引导：模板默认（收集期指向发光金堆、雇佣期指向按钮，上下浮动）。原片为摇杆走位，playable 简化为点击。
- 容错处理：不点击时金堆持续脉冲发光；无失败路径。
- 胜利条件：开采演出进度满（约 3.6 秒）。
- 失败条件：无。
- 结算卡：标题 `GOLD RUSH!`，副标题推断为基地建成主题，CTA `PLAY NOW`（原片文字不可读，文案为拟写）。

## 数值配置（映射 `assets/scripts/gold/GoldRushConfig.ts`）

| 配置项 | 值 | 视频依据 |
| --- | --- | --- |
| crateReward | 25 | 一次拾取约 4-6 根金条，按模板经济折算（保留默认） |
| upgradeCost | 75 | 解锁站点消耗一整背金条（保留默认比例 3 堆=1 次雇佣） |
| battleSpeed | 0.28 | 开采爆发演出约 3-4 秒（frame 41-52 折算压缩） |
| showEnemies | false | 原片无战斗无敌人，纯生产演出 |
| battleCoinBursts | true | frame 44-55：开采期金条持续喷涌 |

## 文案清单（映射 Config 的 `texts` 字段；原片文字不可读，以下为按玩法拟写）

| 字段 | 文案 |
| --- | --- |
| collect | Tap the gold piles |
| upgrade | Hire the zombie crew |
| battle | Zombies are digging! |
| end | Gold rush unlocked |
| upgradeTitle | HIRE |
| upgradeSub | Spend 75 gold |
| winTitle | GOLD RUSH! |
| winSubtitle | Your mine is booming |
| cta | PLAY NOW |
| baseLabelPrefix | Camp Lv. |

## 美术资产清单（映射 `GoldRushGame` 组件的 SpriteFrame 槽位）

| 槽位 | 视频中的资产描述 | 参考帧 | 尺寸建议(px) |
| --- | --- | --- | --- |
| backgroundFrame | 等距棕色矿区地面+蓝色河流/瀑布+岩石 | 02-collect-loop.png | 720x1280 |
| crateFrame | 发光金条堆（模板中的"箱子"→金堆） | 01-cover.jpg | 150x110 |
| baseFrame | 紫框托盘收集站（金条堆叠） | 03-deposit-unlock.png | 260x160 |
| soldierFrame | 僵尸矿工（绿皮肤、背金条筐） | 01-cover.jpg | 96x132 |
| enemyFrame | 不使用（showEnemies=false，可留空） | — | — |
| coinFrame | 单根金条 | 01-cover.jpg | 66x40 |
| buttonFrame | 金黄圆角按钮 | —（推断） | 460x125 |
| handFrame | 白描手指 | —（通用素材） | 85x118 |

## 音效清单（可选，模板暂不接入）

| 时机 | 描述 |
| --- | --- |
| 拾取金条 | 金属叮当 |
| 雇佣成功 | 欢呼短音 |
| 开采爆发 | 连续金币雨声 |

## 与模板的差异点

> 按优先级排序；1、2 为本次落地项。

1. **Battle 阶段改为纯生产演出**：原片无敌人无战斗——士兵=僵尸矿工在基地/矿盘处开采，敌人整层隐藏。→ Config 加 `showEnemies: false` 开关。
2. **开采期金币喷涌**：演出期间持续从矿点喷金币+火花（frame 44-55 的金条雨）。→ Config 加 `battleCoinBursts: true`，View 在 Battle 阶段周期性触发 coinBurst。
3. gold 模板目前文案/数值散在 View 和 Model 里，无 Config 文件 → 本次补齐 `GoldRushConfig.ts`，对齐其他四套模板的四件套约定。
4. 摇杆走位、多站点解锁、传送带经营深度——playable 单点循环不需要，不落地。
