# 仓库指南（给 agent 会话：Codex / Claude Code / 其他）

这是一个 Cocos Creator 3.8 playable 广告模板工程 + 「视频→策划案→playable」流水线。
全貌见 `docs/workflow.md`，策划案 schema 见 `docs/design-doc-template.md`。

## 最高优先级：策划案是事实来源

**这条压过下面所有约定。** 本仓库的主产物是策划案（`docs/design/<名称>.md`），
playable 只是策划案的一次实现。

1. **先改策划案，再改代码。** 用户提出任何玩法/数值/表现改动（哪怕只是一句话），
   第一步写进对应策划案的相应章节，第二步才改 `assets/scripts/`。
   禁止「先实现完再回头补文档」。
2. 策划案按 `docs/design-doc-template.md` 的三冰 schema 组织；新章节需求先进 schema。
3. 「模板映射」表必须机器可校验：`配置项` 写成目标 Config 的点路径（反引号包住），
   `值` 与代码一致；`npm run lint:design` 逐项比对，不一致即失败。
4. 填不出来的格留 `{待定}` 并注明依据缺失，**不允许编造**。

## 两个核心任务的操作手册（纯 markdown，任何 agent 均可执行）

- **视频 → 策划案**：按 `.claude/commands/video-to-design.md` 的步骤执行
  （输入视频路径或 URL，输出 `docs/design/<名称>.md`）。
- **策划案 → playable**：按 `.claude/commands/design-to-playable.md` 的步骤执行
  （输入策划案路径，选模板、填 Config、处理差异点、跑验证）。

> 这两个文件在 Claude Code 里是 slash command，但内容就是普通操作手册；
> 在 Codex 等其他 agent 中，把文件内容连同输入参数作为任务指令即可。

## 验证命令（无编辑器环境，必须全绿）

- `npm run lint:design` —— **策划案 ↔ 代码一致性校验，改任何数值/字段名必跑**
- `npm run typecheck` —— 静态验证，改完代码必跑
- `npm run lint:scenes` —— 场景 JSON 校验（引用完整性 + 资产 uuid + 组件脚本 meta）
- `npm run verify` —— 上面三件套一起跑（提交前）
- 各模板 Model/Sim 冒烟测试：tsc 编译到 temp/smoke 后 node 驱动状态机走全流程
  （用完删除；temp/ 已 gitignore）。改经济/压力数值要用脚本机器人验通关，
  必要时参数扫描选档，结论写回策划案数值设计章节。

## 约定

- 五套模板（gold / towerdefense / merge / match3 / runner）统一四件套结构：
  Config（策划案落点）、Model（纯逻辑，禁止 import 'cc'）、View（代码建树 + box 占位）、
  Game（组件 + SpriteFrame 槽位）。改数值文案只动 Config；改布局动 View 顶部常量表。
- View 布局一律写 390x844 web 坐标，经 `common/Layout.ts` 换算到 720x1280 设计分辨率。
- 场景文件是手写 JSON（无 .meta，编辑器首开自动生成）；新场景 = 复制现有 scene 改
  `_name` 和 `_id` 前缀，再到 `common/TemplateBootstrap.ts` 注册。
- `types/cc.d.ts` 是手写 stub，只覆盖用到的引擎 API；新代码用了新 API 就同步扩充 stub，
  保持与真实 cc 签名兼容；不要引入真实 cc npm 包。
- CTA 与广告生命周期统一走 `common/PlayableSdk.ts`，每个模板的 CTA URL 在自己的 Config 里。
- **3D 模块层**（新 playable 优先）：功能模块在 `assets/scripts/modules/<名>/`，
  一律 Sim（纯逻辑，禁止 import 'cc'）+ Module（视觉）两文件；模块间只通过
  framework/EventBus 和构造注入通信。拼新 playable = `playables/<名>/` 下
  Config + createSim 接线 + Game 宿主 + views/ 下每功能一个 View 组件（@property
  美术槽位；FBX 动画走 common3d/FbxAnimator 状态机），场景复制骨架后在
  TemplateBootstrap 注册。
  3D 占位用 `common3d/Placeholder3D.ts`，相机/灯光由 CameraRigModule 运行时创建。
- 不要手写 .meta、不要提交 library/ temp/ build/ 等编辑器生成目录。
