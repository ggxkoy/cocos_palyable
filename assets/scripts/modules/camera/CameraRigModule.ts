import { Camera, Color, DirectionalLight, Node, Vec3 } from 'cc';
import { ModuleContext, PlayableModule } from '../../framework/Module';

// 等距相机 + 平行光。相机跟随主角在三屏大地图间移动（阻尼插值），
// UI 相机改为仅清深度、只渲染 UI 层，叠加在 3D 画面上。
export interface CameraRigConfig {
    readonly offset: { readonly x: number; readonly y: number; readonly z: number };
    readonly lookOffset: { readonly x: number; readonly y: number; readonly z: number };
    readonly followDamp: number;
    readonly fov: number;
}

const SKY = new Color(210, 180, 140, 255);
const CLEAR_ALL = 7;
const CLEAR_DEPTH_STENCIL = 6;
const LAYER_DEFAULT = 1 << 30;
const LAYER_UI_2D = 1 << 25;

export class CameraRigModule implements PlayableModule {
    private cameraNode: Node | null = null;
    private followX = 0;
    private followZ = 0;

    constructor(
        private readonly config: CameraRigConfig,
        private readonly uiCamera: Camera | null,
        private readonly follow: () => { x: number; z: number },
    ) {}

    public start(context: ModuleContext): void {
        const target = this.follow();
        this.followX = target.x;
        this.followZ = target.z;

        const cameraNode = new Node('Camera3D');
        context.world.addChild(cameraNode);
        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.PERSPECTIVE;
        camera.fov = this.config.fov;
        camera.near = 0.3;
        camera.far = 160;
        camera.priority = -10;
        camera.visibility = LAYER_DEFAULT;
        camera.clearFlags = CLEAR_ALL;
        camera.clearColor = SKY.clone();
        this.cameraNode = cameraNode;
        this.place(1);
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

    public tick(deltaTime: number): void {
        const target = this.follow();
        const damp = Math.min(1, this.config.followDamp * deltaTime);
        this.followX += (target.x - this.followX) * damp;
        this.followZ += (target.z - this.followZ) * damp;
        this.place(1);
    }

    private place(_weight: number): void {
        if (!this.cameraNode) {
            return;
        }
        const offset = this.config.offset;
        this.cameraNode.setPosition(this.followX + offset.x, offset.y, this.followZ + offset.z);
        const look = this.config.lookOffset;
        this.cameraNode.lookAt(new Vec3(this.followX + look.x, look.y, this.followZ + look.z));
    }
}
