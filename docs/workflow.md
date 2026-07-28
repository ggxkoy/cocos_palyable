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

## 第一原则：策划案是事实来源

主产物是策划案，playable 是它的一次实现。任何玩法/数值/表现改动**先进策划案、再进代码**；
策划案「模板映射」表用点路径写死到 Config 字段，`npm run lint:design` 逐项比对，
代码悄悄改了数值而文档没跟上会直接失败。策划案 schema 对标
`docs/design/reference/三冰-试玩广告脚本-模拟经营+策略.pdf`。

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

## 3D 模块层（推荐的新 playable 形态）

2D 模板适合快速切片；正式产出走 **3D 模块拼装**（参考视频都是等距 3D）：

- `assets/scripts/framework/` —— 模块契约：`EventBus`（模块间唯一通信通道）、
  `Module.ts`（ModuleContext：world 3D 根 / ui 2D 根 / bus / camera3d）。
- `assets/scripts/common3d/Placeholder3D.ts` —— 运行时纯色盒子网格
  （MeshRenderer + builtin-standard），3D 版占位资产；换美术=换模型 prefab。
- `assets/scripts/modules/<名>/` —— 每个玩法功能一个模块，**Sim（纯逻辑，
  node 可冒烟）+ Module（cc 视觉）** 两个文件。现有模块：
  economy（双货币：子弹包送达才入弹池、金币只来自杀敌）、depot（回收机：废料排队
  加工成子弹包实体，堆满停机）、work/JobProvider（通用作业接口，
  主角与雇员对接任何作业源）、rope（打捞绳：分级残骸+绳长/质量等级+持续拉拽作业）、
  harvest（矿脉/残骸+重生，JobProvider 的另一种实现）、pickups（类型化掉落物）、
  avatar（虚拟摇杆主角+感知状态机：金币入账/废料背身/敌人近战远程/范围自动作业）、
  workers（行为树雇员，JobProvider 大脑）、goalchain(目标链+非线性驻留购买+
  requirement 门槛+fail/revive)、defense（敌潮+实体子弹炮塔+围墙耐久+攻墙/击破）、
  camera（等距跟随相机+灯光）、stage（三屏大地图+泥潭带）、guide（3D 定向引导）、
  ammoui（炮塔弹药牌+兑换/金币飘字，世界坐标投影到 UI）、hud（2D 叠加）、
  endcard（胜利/失败结算+复活重试+CTA）。
- **拼一个新 playable** = `assets/scripts/playables/<名>/`：
  Config（纯配置：世界坐标、经济、文案、CTA）、Sim（createXxxSim：挑纯逻辑模块、
  注入依赖、总线接线）、Game 宿主（sim + 共享上下文 + 模块注册表 + 主循环）
  ＋ `views/` 每个功能一个薄 View 组件（cc 组件，@property 美术槽位，场景里
  一节点一组件——改主角外观只动 AvatarView，改防线只动 DefenseView，互不牵扯）
  ＋ 复制一个场景骨架注册到 TemplateBootstrap。场景 JSON 可直接按 uuid 预接
  prefab/AnimationClip（FBX 子资产 uuid 见 .fbx.meta 的 subMetas）。
- **FBX 动画状态机**：`common3d/FbxAnimator.ts`——整剪辑状态（@idle1/@walk1 这类
  独立剪辑文件）与帧段状态（单条 Take 001 按帧号 from/to 切段，对应美术给的
  帧数说明 txt）统一成「状态名 → 播放行为」，视觉模块只报状态名。
  模型实例化后用 `common3d/ModelFit.ts` 按包围盒自适应目标高度，保证可见。
- 首个成品：`playables/salvage3d/`（废土打捞防线 3D 版），场景 `salvage3d.scene`。
- 3D 场景无需手写相机/灯光进 JSON：沿用 2D 场景骨架，相机、平行光、全部 3D
  节点均由 CameraRigModule / 各模块在运行时创建。

## 验证手段（无编辑器环境可用）

- `npm run lint:design` —— 策划案「模板映射」表 ↔ 真实 Config 逐项比对（防文档漂移）
- `npm run typecheck` —— 全部脚本 strict 检查（types/cc.d.ts stub）
- `npm run lint:scenes` —— 校验 scene JSON：__id__ 引用、资产 __uuid__（含 FBX
  子资产）真实存在、自定义组件压缩 uuid 有对应脚本 meta
- Model 冒烟 —— tsc 编译到 temp/ 后用 node 驱动状态机走全流程（FbxAnimator
  可用 mock 的 cc 模块单测帧段/循环/一次性逻辑）
- `npm run verify` —— design/typecheck/scenes 三件套，提交前跑

## 新增玩法模板的方法

1. 建 `assets/scripts/<新玩法>/`，按 Config/Model/View/Game 四件套写（抄最像的现有模板）。
2. 复制任意 `assets/scenes/*.scene` 改文件名、`_name`、`_id` 前缀。
3. 在 `common/TemplateBootstrap.ts` 的 TEMPLATES 表注册 场景名 → Game 组件。
4. 补 Model 冒烟测试，跑 typecheck + 场景 lint。
