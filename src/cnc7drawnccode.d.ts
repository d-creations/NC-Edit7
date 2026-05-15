declare module 'cnc7drawnccode' {
    export class DrawBoard {
        camera: Camera;
        constructor(canvas: HTMLCanvasElement, camera: Camera);
        draw(): void;
        clearAll(): void;
        undo(): void;
        redo(): void;
        zoom(factor: number): void;
    }

    export class Camera {
        constructor();
        moveX(delta: number): void;
        moveY(delta: number): void;
    }

    export class PropertyEditor {
        constructor(parentDiv: HTMLElement, drawBoard: DrawBoard);
        setObject(obj: any): void;
        render(): void;
    }

    export class MouseControl {
        constructor(parentElement: HTMLElement, drawBoard: DrawBoard);
        setState(state: number): void;
        mouseClicked(e: { x: number, y: number, button: number }): void;
        mouseDown(e: { x: number, y: number, button: number }): void;
        mouseUp(e: { x: number, y: number, button: number }): void;
        mouseMove(e: { x: number, y: number, button: number }): void;        onStateChange?: () => void;
    }

    export class ToolInstructionProvider {
        constructor(mouseControl: MouseControl);
        getSnapshot(): any;
        setFieldValue(fieldId: string, value: string | number): void;
        runAction(actionId: string): void;
    }

    export class PropertySchemaProvider {
        constructor(drawBoard: DrawBoard);
        setObject(obj: any): void;
        getSchema(): any;
        applyFieldValue(fieldId: string, value: string | number): void;
        runAction(actionId: string): void;    }

    export const MouseState: {
        NONE: number;
        POINT: number;
        LINE: number;
        SELECT: number;
        TOUCH_ROTATE: number;
        TOUCH_ZOOM_PAN: number;
        MOVE: number;
        CIRCLE: number;
        CIRCLE_3P: number;
        CIRCLE_2T1R: number;
        CIRCLE_3T: number;
        MEASURE_LENGTH: number;
        MEASURE_ANGLE: number;
        MEASURE_RADIUS: number;
        PASTE: number;
        ARC: number;
        ARC_3P: number;
        MEASURE_HORIZONTAL: number;
        MEASURE_VERTICAL: number;
        CONSTRAINT_HORIZONTAL: number;
        CONSTRAINT_VERTICAL: number;
        CONSTRAINT_TANGENT: number;
        MEASURE_LINECIRCLE: number;
        CHAMFER_45: number;
        FILLET_ARC: number;
        TRIM: number;
        EXTEND: number;
        CAM_PATH: number;
    };
}
