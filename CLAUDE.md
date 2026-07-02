# 仓库指南（给 agent 会话）

这是一个 Cocos Creator 3.8 playable 广告模板工程 + 「视频→策划案→playable」流水线。
全貌见 `docs/workflow.md`，策划案 schema 见 `docs/design-doc-template.md`。

## 常用命令

- `npm run typecheck` —— 唯一的静态验证手段，改完代码必跑
- `/video-to-design <视频路径>` —— 参考视频 → `docs/design/<名称>.md` 策划案
- `/design-to-playable <策划案路径>` —— 策划案 → 模板实例化

## 约定

- 五套模板（gold / towerdefense / merge / match3 / runner）统一四件套结构：
  Config（策划案落点）、Model（纯逻辑，禁止 import 'cc'）、View（代码建树 + box 占位）、
  Game（组件 + SpriteFrame 槽位）。改数值文案只动 Config；改布局动 View 顶部常量表。
- View 布局一律写 390x844 web 坐标，经 `common/Layout.ts` 换算到 720x1280 设计分辨率。
- 场景文件是手写 JSON（无 .meta，编辑器首开自动生成）；新场景 = 复制现有 scene 改
  `_name` 和 `_id` 前缀，再到 `common/TemplateBootstrap.ts` 注册。
- `types/cc.d.ts` 是手写 stub，只覆盖用到的引擎 API；新代码用了新 API 就同步扩充 stub，
  保持与真实 cc 签名兼容。
- CTA 与广告生命周期统一走 `common/PlayableSdk.ts`，每个模板的 CTA URL 在自己的 Config 里。
- 本环境没有 Cocos 编辑器：验证靠 typecheck + 场景 JSON lint + Model 冒烟
  （tsc 编译到 temp/smoke 再用 node 驱动，用完删除；temp/ 已 gitignore）。
- 提交推送到分支 `claude/cocos-playable-rebuild-78po8l`，不要开 PR 除非用户要求。
