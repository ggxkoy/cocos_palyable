# Playable 策划案：经典地铁跑酷（Classic Runner）

> 由 `/video-to-design` 从参考视频解析生成，交给 `/design-to-playable` 在 Cocos 工程中落地。

## 元信息

| 字段 | 值 |
| --- | --- |
| 案例来源 | `reference/incoming/classic-runner.mp4`（archive.org `vcompress_262`，Subway Surfers「San Francisco」iPhone 实机录像） |
| 分析日期 | 2026-07-02 |
| 视频时长 | 402 秒（0:00-0:55 为菜单，实际跑动约 0:55-6:20） |
| 模板类型 | runner |
| 对应场景 | runner |
| 屏幕方向 | 竖屏 720x1280 |
| 推广产品 | Subway Surfers 类经典跑酷（换皮用） |
| CTA 链接 | 待广告主提供（当前保留模板默认 onelink 占位） |

## 玩法概述

第三人称背视三轨跑酷：角色自动向前跑，玩家左右换道躲避火车与栏杆、沿途吃金币和道具；撞上障碍即结束，随后进入分数结算与奖励页导向下载。playable 版将其压缩为 15-20 秒的单次跑动 + 结算卡 CTA。

## 流程分解（时间轴，参考视频）

| 时间段 | 阶段 | 玩家操作 | 画面反馈 | 备注 |
| --- | --- | --- | --- | --- |
| 0:00-0:55 | 菜单/弹窗 | 点击 Tap to Play | 主界面、活动弹窗 | playable 不做菜单，直接开跑 |
| 0:55-1:00 | 起跑 | 无 | 角色入场，"S" 起跑特效，HUD 出现 | 对应模板引导期（手指提示左右点击） |
| 1:00-6:00 | 跑动主循环 | 左右滑换道（playable 简化为点左/右半屏）、上滑跳、下滑铲 | 金币逐枚吸收+计数跳动；分数持续上涨；火车单列/双列交错逼近；磁铁等道具吸金币 | 障碍波与金币列交替出现，同一时刻至少一条安全车道 |
| 间歇 | 险情演出 | 换道 | 双列火车对开夹击（frame 04）、桥段场景变化 | 模板用 doubleObstacleChance 表达 |
| ~6:20 | 结束 | 无 | 撞车 → 分数结算、每日高分、开箱奖励（frame 06） | playable 压缩为结算卡 + CTA |

## 交互与引导

- 手指引导：起跑后立即出现，在屏幕下方左右两侧交替点动（模板 `RunnerView` 已实现，首次点击后消失）。
- 操作简化：参考视频为滑动操作；playable 采用模板的「点左半屏向左、点右半屏向右」，降低门槛。
- 容错处理：障碍生成保证每波至少一条安全车道（模板 spawnWave 已保证，冒烟 20/20 可通关）。
- 胜利条件：存活到倒计时结束（18 秒）。
- 失败条件：撞上障碍（立即出结算卡，文案区分胜负，CTA 相同）。
- 结算卡：胜 `FINISH!`／负 `CRASH!`，副标题 + `PLAY NOW` CTA。

## 数值配置（映射 `assets/scripts/runner/RunnerConfig.ts`）

| 配置项 | 值 | 视频依据 |
| --- | --- | --- |
| duration | 18 | playable 时长惯例；参考跑动节选 |
| spawnInterval | 0.85 | 视频中障碍波间隔 0.8-1s（车流密度中等） |
| itemSpeed | 0.55 | 与视频前进速度体感一致（保留模板默认） |
| coinChance | 0.9 | 视频中金币几乎每波都有（frame 03 金币列） |
| doubleObstacleChance | 0.35 | 双列火车段占比约 1/3（frame 04） |
| playerZoneMin / Max | 0.82 / 0.94 | 保留模板默认碰撞窗口 |

## 文案清单（映射 Config 的 `texts` 字段）

| 字段 | 文案 |
| --- | --- |
| hudMessage | Tap left / right to dodge |
| scorePrefix | Coins |
| timePrefix | Time |
| winTitle | FINISH! |
| failTitle | CRASH! |
| subtitle | Dodge the trains, grab the gold |
| cta | PLAY NOW |

## 美术资产清单（映射 `RunnerGame` 组件的 SpriteFrame 槽位）

| 槽位 | 视频中的资产描述 | 参考帧 | 尺寸建议(px) |
| --- | --- | --- | --- |
| backgroundFrame | 铁轨场景俯视透视背景（车站/大桥段，暖色墙面+三条枕木铁轨） | classic-runner-frames/02-run-start.png | 720x1280 |
| playerFrame | 跑者背影（含跑步动画首帧即可） | 02-run-start.png | 104x132 |
| obstacleFrame | 火车头/栏杆（近景红蓝车厢） | 04-double-trains.png | 130x104 |
| coinFrame | 金币（旋转帧取正面） | 03-coin-line.png | 66x66 |
| buttonFrame | 金黄圆角按钮（结算 CTA） | 06-endscreen.png | 484x130 |
| handFrame | 白描手指引导图 | —（视频无，用通用素材） | 85x118 |

## 音效清单（可选，模板暂不接入）

| 时机 | 描述 |
| --- | --- |
| 吃金币 | 清脆叮声（视频中连续叮叮） |
| 撞车 | 低沉碰撞 + 短震屏 |
| 结算 | 上扬结算音 |

## 与模板的差异点

> 按优先级排序；1 为本次落地项，其余留作增强。

1. **金币成列出现**：视频中金币总是 3-6 枚连成一列在同一车道（frame 03），模板目前每波最多 1 枚散币。→ 给 Config 加 `coinRunLength`，生成时在同一安全车道连发 N 枚。
2. 上滑跳/下滑铲（矮栏杆、上下层障碍）——模板无纵向动作，暂不落地。
3. 磁铁/喷气/倍数等道具（frame 05）——暂不落地。
4. 撞车前 hoverboard 救援与二次机会——playable 单次跑动不需要。
