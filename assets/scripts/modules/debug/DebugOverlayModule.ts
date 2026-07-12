import { Color, Label, UITransform } from 'cc';
import { DESIGN_HEIGHT } from '../../common/Layout';
import { createLabel, createNode } from '../../common/PlaceholderFactory';
import { diag, diagConsumeDirty, diagText } from '../../common3d/Diag';
import { ModuleContext, PlayableModule } from '../../framework/Module';

// 屏幕诊断面板：把 diag() 的内容画在画面左上角。
// 用途：无 devtools 的真机/预览验收——一张截图就能带回模型装配诊断。
// 交付前把 Config 的 debugOverlay 关掉即可（组件与模块都不用删）。
const TEXT = new Color(180, 255, 190, 255);

export class DebugOverlayModule implements PlayableModule {
    private label: Label | null = null;

    public start(context: ModuleContext): void {
        const root = createNode('DebugOverlay', context.ui, 0, 0);
        const label = createLabel('DiagText', root, 0, 0, '', 16, TEXT);
        label.isBold = false;
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        const transform = label.node.getComponent(UITransform);
        transform?.setAnchorPoint(0, 1);
        label.node.setPosition(-350, DESIGN_HEIGHT / 2 - 150, 0);
        this.label = label;
        diag('[Diag] overlay online');
    }

    public tick(): void {
        if (this.label && diagConsumeDirty()) {
            this.label.string = diagText();
        }
    }
}
