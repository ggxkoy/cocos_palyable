# Cocos Playable 模板工厂

一条 playable 广告生产流水线：**参考视频 → 策划案（markdown）→ agent 在 Cocos Creator 3.8 工程中实例化玩法模板**。缺失美术全部用占位 box 渲染，后续把真实图拖入组件槽位即完成换皮。

## 快速开始

### 网页入口（便于分享）

```bash
npm ci
npm run planner:start
```

浏览器打开 `http://127.0.0.1:4310`，输入视频链接或上传 MP4/MOV/WEBM 文件即可调用现有
`video-to-design` 流程，生成结果会保存到 `docs/design/` 并显示在网页中。
Agent 运行器支持 Codex、Claude Code、OpenCode、OpenClaw。OpenCode / OpenClaw 可进一步选择
DeepSeek、智谱 GLM、MiniMax 或自定义 `provider/model`；模型留空时使用网页中的推荐默认值。

API Key 只在运行服务的电脑上配置，不会发送到网页：

```powershell
$env:DEEPSEEK_API_KEY="..."
$env:ZHIPUAI_API_KEY="..."   # 也兼容 ZAI_API_KEY
$env:MINIMAX_API_KEY="..."   # 海外账号另设 MINIMAX_BASE_URL=https://api.minimax.io/v1
npm run planner:start
```

局域网分享：

```bash
npm run planner:start -- --host 0.0.0.0
```

服务会在终端打印带临时访问密钥的局域网地址，直接把完整地址发给同一局域网内的使用者。
运行服务的电脑必须安装并登录至少一个 Agent CLI；`PLANNER_AGENT=codex|claude|opencode|openclaw`
可设置网页默认运行器。非标准安装路径可通过 `PLANNER_CODEX_BIN`、`PLANNER_CLAUDE_BIN`、
`PLANNER_OPENCODE_BIN`、`PLANNER_OPENCLAW_BIN` 指定。
不要把该服务直接暴露到公网，公网部署应增加正式身份认证和任务配额。

### 用工作流（推荐）

1. 把参考视频放进 `reference/incoming/` 并提交。
2. 在 Claude Code 会话运行 `/video-to-design reference/incoming/<视频>` → 生成 `docs/design/<名称>.md` 策划案。
3. 运行 `/design-to-playable docs/design/<名称>.md` → agent 选模板、填配置、跑验证。
4. 在 Cocos Creator 3.8.x 打开工程，打开对应场景预览。

完整说明见 [`docs/workflow.md`](docs/workflow.md)，策划案格式见 [`docs/design-doc-template.md`](docs/design-doc-template.md)。

### 直接打开工程

1. Cocos Creator Dashboard（3.8.x）添加仓库根目录为项目。
2. 首次打开会自动生成缺失的 `.meta`（生成后提交）。
3. 打开 `assets/scenes/` 下任一场景并预览——`TemplateBootstrap` 会按场景名自动挂载对应玩法组件，零手动配置。

## 玩法模板目录

| 模板 | 场景 | 核心循环 | 逻辑冒烟验证 |
| --- | --- | --- | --- |
| 收集升级（金闪闪重建） | `maingame` | 点亮箱子收金 → 升级基地 → 战斗演出 → 结算 CTA | 收集→升级→3.6s 战斗→结算 |
| 塔防 | `towerdefense` | 点槽位建塔 → 自动攻击路径敌人 → 守住/失守 | 3 塔通关 / 无塔失败 |
| 拖拽合成 | `merge` | 拖同级物品合成升级 → 达到 Lv4 结算 | 4 步引导链到达目标 |
| 三消 | `match3` | 点选交换、三连消除 → 限步达分 | 固定种子 4 步达标 |
| 跑酷躲避 | `runner` | 点左右切道躲障碍吃金币 → 限时跑完/撞车 | 前瞻躲避 20/20 通关 |
| 行为树经营 | `crew` | 工人自主采集运送入库，点雇佣/解锁扩产 → 繁荣结算 | 行为树循环 + 全购买流通关 |

每套模板统一四件套（`assets/scripts/<template>/`）：

- **Config** —— 策划案落点：文案、数值、CTA 链接，一处修改全局生效
- **Model** —— 纯逻辑状态机（零 `cc` 依赖，可 node 单测）
- **View** —— 代码动态建节点树 + box 占位；布局常量表用 390x844 web 坐标（`common/Layout.ts` 换算）
- **Game** —— Cocos 组件：输入绑定、Model/View 粘合、`SpriteFrame` 美术槽位

共享层 `assets/scripts/common/`：PlaceholderFactory（白帧+box/label/手指）、PlayableSdk（MRAID → FB Playable → dapi → postMessage/ExitApi → window.open 的 CTA 链 + `ad-event-pause/resume`）、SparkSystem、EndCard、TemplateBootstrap（场景名 → 组件注册表）。

## 替换占位美术

选中场景 `Canvas/GameRoot`，手动添加对应 `<Template>Game` 组件（bootstrap 检测到后不会重复挂载），把导入的 SpriteFrame 拖入槽位。填了真实图的部位自动跳过手绘细节 box，留空槽位继续用 box 占位。

## 验证（无编辑器环境）

- `npm run typecheck` —— 全部脚本 strict 检查（基于手写 stub `types/cc.d.ts`；编辑器内如与真实声明冲突，把 `types/` 从 tsconfig include 移除即可）
- 场景 JSON lint 与各模板 Model 冒烟脚本写法见 `CLAUDE.md` 与 git 历史

## 参考与预览

- `reference/gold-reference.html` —— 原始"金闪闪"单文件 Cocos playable（720x1280、`maingame.scene`、CTA 与广告生命周期均被模板复刻）
- `reference/incoming/` —— 参考视频上传入口
- `web/` 与 `web/gold/` —— 早期 HTML5 Canvas 预览切片（塔防、收集升级），可直接浏览器打开，是 Cocos 模板布局参数的行为参照
