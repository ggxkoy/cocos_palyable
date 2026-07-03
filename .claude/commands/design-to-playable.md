---
description: 按策划案在 Cocos 工程中落地 playable（docs/design/<名称>.md → 可运行模板实例）
---

按策划案把对应玩法模板实例化成可运行的 Cocos playable。输入：`$ARGUMENTS`（策划案路径，`docs/design/*.md`）。

## 步骤

1. **读策划案**：解析「模板类型」「数值配置」「文案清单」「美术资产清单」「与模板的差异点」。

2. **应用配置**（不改玩法时只动 Config）
   - 打开 `assets/scripts/<template>/<Template>Config.ts`，把策划案数值配置和文案逐项填入；CTA 链接写进 `ctaUrl`。
   - 布局差异（位置/尺寸）改对应 `<Template>View.ts` 顶部的常量表（全部是 390x844 web 坐标）。

3. **处理差异点**
   - 「与模板的差异点」为空 → 跳过。
   - 有差异 → 逻辑改 `<Template>Model.ts`（保持纯逻辑、无 cc 依赖），表现改 `<Template>View.ts`。新增可调参数一律进 Config。
   - 差异大到不属于任何模板 → 参照现有模板结构在 `assets/scripts/<新玩法>/` 新建 Model/View/Game/Config 四件套 + 场景（复制任一 scene 改 `_name` 与 `_id` 前缀），并在 `common/TemplateBootstrap.ts` 的 TEMPLATES 表注册。

4. **占位资产**：美术清单先全部用默认 box 占位（什么都不用做，槽位留空即是）；策划案里的资产清单保留给后续替换真实美术时对照。

5. **验证**（全部通过才算完成）
   - `npm run typecheck`
   - 场景 JSON lint（引用完整性；沿用仓库既有的 node 内联校验脚本写法）
   - 对应模板 Model 冒烟测试：按策划案流程走一遍状态机（可参考 git 历史中的冒烟脚本）。

6. **交付**：提交并推送到当前分支；总结改了哪些文件、策划案中哪些项落地了、哪些留待美术替换。
