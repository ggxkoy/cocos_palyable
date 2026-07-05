# 仓库指南（给 agent 会话：Codex / Claude Code / 其他）

这是一个 Cocos Creator 3.8 playable 广告模板工程 + 「视频→策划案→playable」流水线。
全貌见 `docs/workflow.md`，策划案 schema 见 `docs/design-doc-template.md`。

## 两个核心任务的操作手册（纯 markdown，任何 agent 均可执行）

- **视频 → 策划案**：按 `.claude/commands/video-to-design.md` 的步骤执行
  （输入视频路径或 URL，输出 `docs/design/<名称>.md`）。
- **策划案 → playable**：按 `.claude/commands/design-to-playable.md` 的步骤执行
  （输入策划案路径，选模板、填 Config、处理差异点、跑验证）。

> 这两个文件在 Claude Code 里是 slash command，但内容就是普通操作手册；
> 在 Codex 等其他 agent 中，把文件内容连同输入参数作为任务指令即可。

## 验证命令（无编辑器环境，必须全绿）

- `npm run typecheck` —— 唯一的静态验证手段，改完代码必跑
- 场景 JSON lint 与各模板 Model 冒烟测试：写法参考 git 历史中的 node 内联脚本
  （tsc 编译到 temp/smoke 再用 node 驱动状态机，用完删除；temp/ 已 gitignore）

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
  Config + createSim 接线 + Game 模块清单，场景复制骨架后在 TemplateBootstrap 注册。
  3D 占位用 `common3d/Placeholder3D.ts`，相机/灯光由 CameraRigModule 运行时创建。
- 不要手写 .meta、不要提交 library/ temp/ build/ 等编辑器生成目录。
