# 工作流：参考视频 → 策划案 → Cocos Playable

本仓库是一条 playable 广告生产流水线：一头输入参考视频（或竞品单文件包），
中间产出结构化策划案（markdown），另一头由 agent 按策划案在 Cocos Creator 3.8
工程中实例化玩法模板，产出可运行的 playable。

```
参考视频 (.mp4 / 竞品 .html)
   │  放入 reference/incoming/
   ▼
/video-to-design  ──关键帧抽取+玩法分析──▶  docs/design/<名称>.md（策划案）
   │                                          结构见 docs/design-doc-template.md
   ▼
/design-to-playable ──选模板+填 Config+处理差异──▶  可运行的模板实例
   │                                                （box 占位美术）
   ▼
Cocos Creator 打开 assets/scenes/<模板>.scene 预览
   │  把真实美术拖入 <Template>Game 组件的 SpriteFrame 槽位
   ▼
构建导出 web-mobile 单文件 playable
```

## 三层结构

1. **入口层**：`reference/incoming/`（视频上传目录）+ 两条 slash 命令（`.claude/commands/`）。
2. **策划案层**：`docs/design/*.md`，schema 固定（`docs/design-doc-template.md`），
   字段与模板 Config 一一对应——策划案就是模板的填参说明书。
3. **模板层**：五套玩法模板（见下表），统一模式：
   - `<Template>Config.ts` —— 策划案落点：文案、数值、CTA，一处改全局生效
   - `<Template>Model.ts` —— 纯逻辑状态机，零 cc 依赖，可单测
   - `<Template>View.ts` —— 代码建节点树，box 占位，布局常量表（390x844 web 坐标）
   - `<Template>Game.ts` —— Cocos 组件：输入绑定 + Model/View 粘合 + SpriteFrame 美术槽位
   - `assets/scenes/<name>.scene` —— 极简场景，`common/TemplateBootstrap.ts` 按场景名自动挂组件

## 模板目录

| 模板类型 | 场景 | 代码目录 | 核心循环 | 美术槽位 |
| --- | --- | --- | --- | --- |
| collect-upgrade | maingame | assets/scripts/gold/ | 点箱收金 → 升级基地 → 战斗演出 → 结算 | background/crate/base/soldier/enemy/coin/button/hand |
| towerdefense | towerdefense | assets/scripts/towerdefense/ | 点槽位建塔 → 自动攻击路径敌人 → 守住/失守结算 | background/slot/tower/enemy/button/hand |
| merge | merge | assets/scripts/merge/ | 拖同级物品合成升级 → 达到目标等级结算 | background/cell/item/button/hand |
| match3 | match3 | assets/scripts/match3/ | 点选交换、三连消除 → 限步达分结算 | background/gem/button/hand |
| runner | runner | assets/scripts/runner/ | 点左右切道躲障碍吃金币 → 限时跑完/撞车结算 | background/player/obstacle/coin/button/hand |
| crew | crew | assets/scripts/crew/ | 主角点击移动+范围自动采集，雇员（购买的自动化）行为树自主跑「采集→搬运→入库」，目标链到亲手开金库结算（解压经营型首选；换一棵树即可做战斗人物） | background/vein/depot/worker/button/hand |

共享层（`assets/scripts/common/`）：PlaceholderFactory（box/label/手指占位）、
PlayableSdk（多平台 CTA download 链 + ad-event pause/resume）、SparkSystem（火花粒子）、
EndCard（结算卡）、Layout（坐标换算）、TemplateBootstrap（场景→组件注册表）、
BehaviorTree（Sequence/Selector/Condition/Action/Repeat，驱动自主人物：
经营型工人循环与战斗型士兵行为共用同一套节点，只换树的结构）。

## 验证手段（无编辑器环境可用）

- `npm run typecheck` —— 全部脚本 strict 检查（types/cc.d.ts stub）
- 场景 lint —— node 校验 scene JSON 引用完整性
- Model 冒烟 —— tsc 编译到 temp/ 后用 node 驱动状态机走全流程

## 新增玩法模板的方法

1. 建 `assets/scripts/<新玩法>/`，按 Config/Model/View/Game 四件套写（抄最像的现有模板）。
2. 复制任意 `assets/scenes/*.scene` 改文件名、`_name`、`_id` 前缀。
3. 在 `common/TemplateBootstrap.ts` 的 TEMPLATES 表注册 场景名 → Game 组件。
4. 补 Model 冒烟测试，跑 typecheck + 场景 lint。
