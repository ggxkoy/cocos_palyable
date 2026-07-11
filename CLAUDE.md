# 仓库指南（给 agent 会话）

这是一个 Cocos Creator 3.8 playable 广告模板工程 + 「视频→策划案→playable」流水线。
全貌见 `docs/workflow.md`，策划案 schema 见 `docs/design-doc-template.md`。

## 常用命令

- `npm run typecheck` —— 静态验证，改完代码必跑
- `npm run lint:scenes` —— 场景 JSON 校验（__id__ 引用、资产 __uuid__ 是否存在、
  组件压缩 uuid 是否有对应脚本 meta），改过 .scene / 新增 ccclass 必跑
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
- **3D 模块层**（新 playable 优先）：功能模块在 `assets/scripts/modules/<名>/`，
  一律 Sim（纯逻辑，禁止 import 'cc'）+ Module（视觉）两文件；模块间只通过
  framework/EventBus 和构造注入通信。拼新 playable = `playables/<名>/` 下
  Config + createSim 接线 + Game 宿主（sim+上下文+注册表）+ `views/` 每个功能
  一个薄 View 组件（@property 美术槽位，场景一节点一组件，改某块只动对应组件）。
  场景复制骨架后在 TemplateBootstrap 注册。3D 占位用 `common3d/Placeholder3D.ts`，
  相机/灯光由 CameraRigModule 运行时创建。
- **FBX 动画**：动画统一走 `common3d/FbxAnimator.ts` 状态机——整剪辑状态
  （每状态一条 AnimationClip 资产，View 槽位拖入）或帧段状态（美术把多动作烘进
  单条 Take 001，按帧数说明 txt 的 from/to 切段）。禁止再按剪辑名字符串 getState。
  模型实例化后用 `common3d/ModelFit.ts` 自适应到目标世界高度（FBX 源比例不可控）。
- **场景接资产**：新增 ccclass 脚本要同时手写 `.ts.meta`（uuid 自定即可），场景组件
  `__type__` 用压缩 uuid（算法见 tools/scene-lint.mjs）；prefab/AnimationClip 槽位
  可直接在场景 JSON 里写 `__uuid__`（FBX 子资产 uuid 在对应 .fbx.meta 的 subMetas）。
- 本环境没有 Cocos 编辑器：验证靠 typecheck + `npm run lint:scenes` + Model 冒烟
  （tsc 编译到 temp/smoke 再用 node 驱动，用完删除；temp/ 已 gitignore）。
- 提交推送到分支 `claude/cocos-playable-rebuild-78po8l`，不要开 PR 除非用户要求。
