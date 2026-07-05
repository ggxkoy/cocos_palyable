import { Camera, Color, DirectionalLight, Node, Vec3 } from 'cc';
import { ModuleContext, PlayableModule } from '../../framework/Module';

// 等距相机 + 平行光。UI 相机改为仅清深度、只渲染 UI 层，叠加在 3D 画面上。
export interface CameraRigConfig {
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
    readonly lookAt: { readonly x: number; readonly y: number; readonly z: number };
    readonly fov: number;
}

const SKY = new Color(210, 180, 140, 255);
const CLEAR_ALL = 7;
const CLEAR_DEPTH_STENCIL = 6;
const LAYER_DEFAULT = 1 << 30;
const LAYER_UI_2D = 1 << 25;

export class CameraRigModule implements PlayableModule {
    constructor(
        private readonly config: CameraRigConfig,
        private readonly uiCamera: Camera | null,
    ) {}

    public start(context: ModuleContext): void {
        const cameraNode = new Node('Camera3D');
        context.world.addChild(cameraNode);
        cameraNode.setPosition(this.config.position.x, this.config.position.y, this.config.position.z);
        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.PERSPECTIVE;
        camera.fov = this.config.fov;
        camera.near = 0.3;
        camera.far = 120;
        camera.priority = -10;
        camera.visibility = LAYER_DEFAULT;
        camera.clearFlags = CLEAR_ALL;
        camera.clearColor = SKY.clone();
        cameraNode.lookAt(new Vec3(this.config.lookAt.x, this.config.lookAt.y, this.config.lookAt.z));
        context.camera3d = camera;

        const lightNode = new Node('SunLight');
        context.world.addChild(lightNode);
        lightNode.addComponent(DirectionalLight);
        lightNode.setRotationFromEuler(-56, 32, 0);

        if (this.uiCamera) {
            this.uiCamera.priority = 10;
            this.uiCamera.clearFlags = CLEAR_DEPTH_STENCIL;
            this.uiCamera.visibility = LAYER_UI_2D;
        }
    }
}
