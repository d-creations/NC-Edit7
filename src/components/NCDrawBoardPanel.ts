import { DrawBoard, Camera, MouseControl, MouseState } from 'cnc7drawnccode';

export class NCDrawBoardPanel extends HTMLElement {
    private canvas: HTMLCanvasElement;
    public drawBoard!: DrawBoard;
    public mouseControl!: MouseControl;

    constructor() {
        super();
        
        // 1. Create Canvas
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.display = "block"; // prevents bottom scrollbar space
    }

    connectedCallback() {
        // Ensure relative positioning
        this.style.display = "block";
        this.style.position = "relative";
        this.style.width = "100%";
        this.style.height = "100%";
        this.style.overflow = "hidden";

        this.appendChild(this.canvas);

        // 2. Initialize Engine
        const camera = new Camera();
        this.drawBoard = new DrawBoard(this.canvas, camera);
        
        // Disable internal command tools from generating HTML directly, use only as headless engine
        this.mouseControl = new MouseControl(this, this.drawBoard);

        // 3. Setup Auto-Resizing
        this.setupResizeObserver();

        // 4. Bind Events
        this.setupEventForwarding();
        
        // Connect initial toolbar state
        this.renderToolbar();
    }

    private setupResizeObserver() {
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this.canvas.width = width;
                this.canvas.height = height;
                this.drawBoard.draw();
            }
        });
        ro.observe(this);
    }

    private getPosition(e: MouseEvent) {
        return {
            x: e.offsetX,
            y: e.offsetY,
            button: e.button
        };
    }

    private setupEventForwarding() {
        // Forward DOM interaction to CAD logic using relative offsets
        this.canvas.addEventListener('click', (e) => this.mouseControl.mouseClicked(this.getPosition(e)));
        this.canvas.addEventListener('mousedown', (e) => this.mouseControl.mouseDown(this.getPosition(e)));
        this.canvas.addEventListener('mouseup', (e) => this.mouseControl.mouseUp(this.getPosition(e)));
        this.canvas.addEventListener('mousemove', (e) => this.mouseControl.mouseMove(this.getPosition(e)));
        
        // Disabling context menu to allow custom right-clicks or tool cancellations
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('selection-changed', (e: any) => {
            const { object } = e.detail;
            console.log("NC-Edit7 Canvas Selection Event Fired!", object);
            // Example: Map this to your NC-Edit EventBus properties window updates
            // window.dispatchEvent(new CustomEvent('NC_DRAW_SELECTION', { detail: object }));
        });
    }

    public setTool(toolName: string) {
        switch(toolName) {
            case 'CLEAR': this.drawBoard.clearAll(); break;
            case 'UNDO': this.drawBoard.undo(); break;
            case 'REDO': this.drawBoard.redo(); break;

            case 'ZOOM_IN': this.drawBoard.zoom(1.2); break;
            case 'ZOOM_OUT': this.drawBoard.zoom(1 / 1.2); break;

            case 'SELECT': this.mouseControl.setState(MouseState.SELECT); break;
            case 'MOVE': this.mouseControl.setState(MouseState.MOVE); break;
            case 'POINT': this.mouseControl.setState(MouseState.POINT); break;
            case 'LINE': this.mouseControl.setState(MouseState.LINE); break;
            
            case 'CIRCLE': this.mouseControl.setState(MouseState.CIRCLE); break;
            case 'CIRCLE_3P': this.mouseControl.setState(MouseState.CIRCLE_3P); break;
            case 'CIRCLE_2T1R': this.mouseControl.setState(MouseState.CIRCLE_2T1R); break;
            case 'CIRCLE_3T': this.mouseControl.setState(MouseState.CIRCLE_3T); break;
            
            case 'ARC': this.mouseControl.setState(MouseState.ARC); break;
            case 'ARC_3P': this.mouseControl.setState(MouseState.ARC_3P); break;
            
            case 'CHAMFER_45': this.mouseControl.setState(MouseState.CHAMFER_45); break;
            case 'FILLET_ARC': this.mouseControl.setState(MouseState.FILLET_ARC); break;
            case 'TRIM': this.mouseControl.setState(MouseState.TRIM); break;
            case 'EXTEND': this.mouseControl.setState(MouseState.EXTEND); break;
            case 'CAM_PATH': this.mouseControl.setState(MouseState.CAM_PATH); break;

            case 'MEASURE_LENGTH': this.mouseControl.setState(MouseState.MEASURE_LENGTH); break;
            case 'MEASURE_HORIZONTAL': this.mouseControl.setState(MouseState.MEASURE_HORIZONTAL); break;
            case 'MEASURE_VERTICAL': this.mouseControl.setState(MouseState.MEASURE_VERTICAL); break;
            case 'MEASURE_ANGLE': this.mouseControl.setState(MouseState.MEASURE_ANGLE); break;
            case 'MEASURE_RADIUS': this.mouseControl.setState(MouseState.MEASURE_RADIUS); break;
            case 'MEASURE_LINECIRCLE': this.mouseControl.setState(MouseState.MEASURE_LINECIRCLE); break;

            case 'CONSTRAINT_HORIZONTAL': this.mouseControl.setState(MouseState.CONSTRAINT_HORIZONTAL); break;
            case 'CONSTRAINT_VERTICAL': this.mouseControl.setState(MouseState.CONSTRAINT_VERTICAL); break;
            case 'CONSTRAINT_TANGENT': this.mouseControl.setState(MouseState.CONSTRAINT_TANGENT); break;
        }
    }

    private renderToolbar() {
        // Toolbar Container
        const toolbarDiv = document.createElement('div');
        toolbarDiv.style.position = 'absolute';
        toolbarDiv.style.top = '10px';
        toolbarDiv.style.left = '10px';
        toolbarDiv.style.display = 'flex';
        toolbarDiv.style.gap = '5px';
        toolbarDiv.style.flexWrap = 'nowrap';
        toolbarDiv.style.alignItems = 'center';
        toolbarDiv.style.zIndex = '10';
        toolbarDiv.style.backgroundColor = 'var(--vscode-editor-background, rgba(30,30,30,0.85))';
        toolbarDiv.style.padding = '4px';
        toolbarDiv.style.borderRadius = '4px';
        toolbarDiv.style.border = '1px solid var(--vscode-editorGroup-border, #444)';
        toolbarDiv.style.boxShadow = '0px 2px 5px rgba(0,0,0,0.3)';

        // Helper to format grouped tool dropdowns
        const createGroup = (labelStr: string, options: { label: string, val: string }[]) => {
            const select = document.createElement('select');
            select.style.backgroundColor = 'var(--vscode-dropdown-background, #3c3c3c)';
            select.style.color = 'var(--vscode-dropdown-foreground, #ccc)';
            select.style.border = '1px solid var(--vscode-dropdown-border, #555)';
            select.style.padding = '2px 4px';
            select.style.borderRadius = '2px';
            select.style.cursor = 'pointer';

            const placeholder = document.createElement('option');
            placeholder.text = labelStr;
            placeholder.disabled = true;
            placeholder.selected = true;
            select.appendChild(placeholder);

            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.val;
                o.text = opt.label;
                select.appendChild(o);
            });

            select.onchange = (e) => {
                const target = e.target as HTMLSelectElement;
                if(target.value) {
                    this.setTool(target.value);
                    // Reset back to placeholder so it acts like a menu button
                    target.selectedIndex = 0;
                }
            };
            return select;
        };

        // Quick Buttons for frequent tasks
        const createBtn = (label: string, cmd: string, isDanger = false) => {
            const btn = document.createElement('button');
            btn.innerText = label;
            btn.style.backgroundColor = isDanger ? '#d32f2f' : 'var(--vscode-button-secondaryBackground, #444)';
            btn.style.color = isDanger ? '#fff' : 'var(--vscode-button-secondaryForeground, #ccc)';
            btn.style.border = 'none';
            btn.style.padding = '4px 8px';
            btn.style.cursor = 'pointer';
            btn.style.borderRadius = '2px';
            btn.style.fontSize = '12px';
            
            btn.onclick = () => this.setTool(cmd);
            return btn;
        };

        toolbarDiv.appendChild(createBtn('Zoom +', 'ZOOM_IN'));
        toolbarDiv.appendChild(createBtn('Zoom -', 'ZOOM_OUT'));
        toolbarDiv.appendChild(createBtn('Select', 'SELECT'));
        toolbarDiv.appendChild(createBtn('Point', 'POINT'));
        toolbarDiv.appendChild(createBtn('Line', 'LINE'));

        // Draw Tools Group
        toolbarDiv.appendChild(createGroup('Draw ...', [
            { label: 'Circle (Center + R)', val: 'CIRCLE' },
            { label: 'Circle (3 Points)', val: 'CIRCLE_3P' },
            { label: 'Circle (2 Tangents, 1R)', val: 'CIRCLE_2T1R' },
            { label: 'Circle (3 Tangents)', val: 'CIRCLE_3T' },
            { label: 'Arc (Center + Angles)', val: 'ARC' },
            { label: 'Arc (3 Points)', val: 'ARC_3P' }
        ]));

        // Edit Tools Group
        toolbarDiv.appendChild(createGroup('Edit ...', [
            { label: 'Move / Pan', val: 'MOVE' },
            { label: 'Trim Line', val: 'TRIM' },
            { label: 'Extend Line', val: 'EXTEND' },
            { label: 'Chamfer (45°)', val: 'CHAMFER_45' },
            { label: 'Fillet (Arc)', val: 'FILLET_ARC' }
        ]));

        // Measure Tools Group
        toolbarDiv.appendChild(createGroup('Measure ...', [
            { label: 'Length', val: 'MEASURE_LENGTH' },
            { label: 'Horizontal Dist', val: 'MEASURE_HORIZONTAL' },
            { label: 'Vertical Dist', val: 'MEASURE_VERTICAL' },
            { label: 'Angle', val: 'MEASURE_ANGLE' },
            { label: 'Radius', val: 'MEASURE_RADIUS' },
            { label: 'Line-Circle Disp', val: 'MEASURE_LINECIRCLE' }
        ]));

        // Constraints Group
        toolbarDiv.appendChild(createGroup('Constraints ...', [
            { label: 'Horizontal', val: 'CONSTRAINT_HORIZONTAL' },
            { label: 'Vertical', val: 'CONSTRAINT_VERTICAL' },
            { label: 'Tangent', val: 'CONSTRAINT_TANGENT' }
        ]));

        toolbarDiv.appendChild(createBtn('Undo', 'UNDO'));
        toolbarDiv.appendChild(createBtn('Clear', 'CLEAR', true));

        this.appendChild(toolbarDiv);
    }
}

customElements.define('nc-draw-board-panel', NCDrawBoardPanel);
