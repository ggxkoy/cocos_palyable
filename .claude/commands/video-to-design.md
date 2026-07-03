---
description: 解析参考视频，输出 playable 策划案 markdown（视频 → docs/design/<名称>.md）
---

把参考视频解析成一份结构化策划案。输入：`$ARGUMENTS`（视频**路径或链接**；为空时取 `reference/incoming/` 下最新的视频文件，或用户在对话中附带的视频/截图）。

## 步骤

1. **定位素材**
   - 本地路径 → 直接用。
   - **URL** → 下载到 `reference/incoming/`：
     - 直链视频（`.mp4/.mov/.webm` 或 Content-Type 为 video/*）：`curl -L -o reference/incoming/<名称>.mp4 <url>`。
     - 平台页面链接（YouTube / B 站 / 抖音等）：用 yt-dlp（没有就 `pip3 install --break-system-packages yt-dlp`），`yt-dlp -f "mp4/bv*+ba/b" -o "reference/incoming/<名称>.%(ext)s" <url>`；平台反爬导致失败时，停下来请用户提供直链或直接上传文件。
     - 下载成功后把视频文件提交进仓库（体积 >50MB 时只提交抽出的关键帧，视频留在工作区）。
   - `$ARGUMENTS` 为空 → 找 `reference/incoming/` 下最新的 `.mp4/.mov/.webm/.html` 文件。
   - 如果是 `.html` 单文件 playable（竞品包），跳过抽帧，直接按「gold-reference 分析法」grep 其中的场景名、资源清单、CTA URL、SDK 事件。

2. **抽取关键帧**
   - 优先用 ffmpeg：`ffmpeg -i <视频> -vf fps=1 <scratchpad>/frames/frame_%03d.png`（每秒 1 帧；短于 20s 的视频用 fps=2）。
   - 系统没有 ffmpeg 时用 pip 的静态二进制（本环境已验证可行）：`pip3 install --break-system-packages imageio-ffmpeg`，然后 `FF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")` 用 `$FF` 代替 ffmpeg 命令。
   - 都失败则检查 `reference/incoming/<名称>-frames/` 是否有用户手动放置的截图；都没有就停下来向用户要关键截图，不要凭空编造内容。

3. **逐帧分析**（用 Read 工具看图）
   - **先判目标结构（动机轴）**：看题材和画面表现出的目标，分两类——
     - **战斗压力型**：画面存在敌对单位/生存压力，循环是「收集资源 → 转化为战斗力 → 战斗验证」，弧线是紧张-释放，演出高潮是战斗力兑现时刻；
     - **解压经营型**：无战斗逻辑，前期靠收集/吸附/数字上涨解压，后期模拟经营，**小循环（秒级动作反馈）嵌套完成大循环（解锁/扩产推进）**，演出高潮是产能爆发或基地成型。
     - 注意题材词汇会骗人（如"僵尸矿工"里僵尸是劳动力不是威胁），以画面中有无敌对压力/失败画面为准。目标结构决定时间轴怎么切：战斗型盯压力出现点，经营型盯每个小循环的闭合点。
   - 识别：核心玩法循环（小循环+大循环各是什么）、阶段划分（引导→操作→反馈→结算）、玩家操作方式（点击/拖拽/滑动）、HUD 元素、手指引导的时机与位置、胜负条件、结算卡样式与文案、CTA 按钮文案。
   - 记录时间轴：每个阶段的起止秒数。
   - 列出美术资产：背景、角色、道具、按钮、特效，标注出现的帧号。

4. **匹配模板（操作轴）**：目标结构定弧线之后，按玩家的核心动作动词选代码模板
   - 对照本工程五套模板选最接近的一个：
     | 模板类型 | 特征 |
     | --- | --- |
     | collect-upgrade | 点击收集资源 → 消耗资源升级 → 战斗/演出 → 结算 |
     | towerdefense | 建造/放置单位，敌人沿路径进攻，自动攻击 |
     | merge | 拖动两个同级物品合成更高级 |
     | match3 | 交换相邻元素、三连消除 |
     | runner | 车道切换/躲避障碍/收集，限时或撞击结束 |
   - 都不像就标 `custom`，并在「与模板的差异点」里写清楚需要的新机制。

5. **输出策划案**
   - 按 `docs/design-doc-template.md` 的结构逐节填写，写入 `docs/design/<视频名称>.md`。
   - 数值配置节要与所选模板 `assets/scripts/<template>/<Template>Config.ts` 的字段一一对应；填不出来的字段保留模板默认值并注明。
   - 关键帧截图挑 3-6 张有代表性的复制到 `docs/design/<视频名称>-frames/`，在资产清单中引用。

6. **交付**
   - 用 SendUserFile 把生成的 md 发给用户，并提示下一步：`/design-to-playable docs/design/<名称>.md`。
