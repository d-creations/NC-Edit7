import { ServiceRegistry } from '@core/ServiceRegistry';
import { PARSER_SERVICE_TOKEN } from '@core/ServiceTokens';
import { ParserService } from '@services/ParserService';
// @ts-expect-error - ACE module doesn't export types correctly
import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';

export class NCCodePane extends HTMLElement {
  private editor?: ace.Ace.Editor;
  private parserService: ParserService;
  private channelId: string = '';
  private resizeObserver?: ResizeObserver;

  constructor() {
    super();
    // ACE editor has issues with Shadow DOM, so we render directly to light DOM
    this.parserService = ServiceRegistry.getInstance().get(PARSER_SERVICE_TOKEN);
  }

  static get observedAttributes() {
    return ['channel-id'];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'channel-id') {
      this.channelId = newValue;
    }
  }

  connectedCallback() {
    this.render();
    this.initEditor();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for keyword clicks
    this.addEventListener('keyword-click', ((e: CustomEvent) => {
      const lineNumber = e.detail.lineNumber;
      this.scrollToLine(lineNumber);
    }) as EventListener);
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.editor) {
      this.editor.destroy();
      this.editor = undefined;
    }
  }

  private render() {
    // Ensure host has dimensions and block display
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.position = 'relative';

    // Use a class instead of ID to avoid conflicts across multiple instances
    this.innerHTML = `
      <style>
        .ace_editor {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace !important;
        }
        .ace_line {
            color: #f8f8f2 !important;
        }
        .ace_layer {
            z-index: auto !important;
        }
      </style>
      <div class="ace-editor-container" style="position: absolute; top: 0; right: 0; bottom: 0; left: 0; font-size: 14px; background-color: #272822; color: #f8f8f2; z-index: 1;"></div>
    `;
  }

  private initEditor() {
    const editorElement = this.querySelector('.ace-editor-container') as HTMLElement;
    if (!editorElement) return;

    // Ensure the container has explicit dimensions before initializing ACE
    const rect = this.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Fallback if not yet laid out
      editorElement.style.width = '100%';
      editorElement.style.height = '100%';
    }

    const demoProgram = `%
O0001 (DEMO MACHINING PROGRAM - CHANNEL 1)
(LONGER DEMO PROGRAM FOR VISUALIZATION)
N10 G21 (METRIC UNITS)
N20 G90 (ABSOLUTE POSITIONING)
N30 G17 (XY PLANE)
(TOOL CHANGE)
N40 T1 M06 (TOOL 1 - 10MM END MILL)
N50 G43 H1 (TOOL LENGTH COMPENSATION)
N60 S2000 M03 (SPINDLE ON CW AT 2000 RPM)
(RAPID TO START POSITION)
N70 G00 X0 Y0 Z50
N80 G00 X10 Y10
N90 G00 Z5 (RAPID APPROACH)
(PLUNGE TO DEPTH)
N100 G01 Z-5 F100 (PLUNGE)
(SQUARE POCKET - FIRST PASS)
N110 G01 X60 F300
N120 G01 Y60
N130 G01 X10
N140 G01 Y10
(SECOND PASS - OFFSET)
N150 G01 X15 Y15
N160 G01 X55
N170 G01 Y55
N180 G01 X15
N190 G01 Y15
(DEEPER LEVEL)
N200 G01 Z-10 F100
N210 G01 X60 F300
N220 G01 Y60
N230 G01 X10
N240 G01 Y10
(CIRCULAR INTERPOLATION - ARC MOVES)
N250 G00 Z5
N260 G00 X100 Y35
N270 G01 Z-5 F100
N280 G02 X100 Y35 I0 J15 F200 (FULL CIRCLE CW)
N290 G03 X130 Y35 R15 F200 (ARC CCW)
(DIAGONAL MOVES)
N300 G00 Z5
N310 G00 X150 Y0
N320 G01 Z-3 F100
N330 G01 X200 Y50 F250
N340 G01 X150 Y100
N350 G01 X100 Y50
N360 G01 X150 Y0
(RETRACT AND END)
N370 G00 Z50 (RETRACT)
N380 G00 X0 Y0 (RETURN TO HOME)
N390 M05 (SPINDLE OFF)
N400 M30 (PROGRAM END)
%`;

    this.editor = ace.edit(editorElement, {
      mode: 'ace/mode/text', // TODO: Custom NC mode
      theme: 'ace/theme/monokai',
      fontSize: 14,
      showPrintMargin: false,
      showGutter: true,
      highlightActiveLine: true,
      readOnly: false,
      value: demoProgram, // Demo program for Channel 1
    });

    // Use ResizeObserver to handle dynamic layout changes
    this.resizeObserver = new ResizeObserver(() => {
      this.editor?.resize();
    });
    this.resizeObserver.observe(this);

    // Trigger initial parse
    this.parserService.parse(this.editor.getValue(), this.channelId);

    this.editor.on('change', () => {
      const value = this.editor?.getValue() || '';
      this.dispatchEvent(
        new CustomEvent('code-change', {
          detail: { channelId: this.channelId, code: value },
          bubbles: true,
          composed: true,
        }),
      );

      // Trigger parse
      this.parserService.parse(value, this.channelId);
    });
  }

  setValue(code: string) {
    if (this.editor && this.editor.getValue() !== code) {
      this.editor.setValue(code, -1);
    }
  }

  getValue(): string {
    return this.editor?.getValue() || '';
  }

  scrollToLine(lineNumber: number): void {
    if (!this.editor) return;

    // Convert to 0-based index
    const line = lineNumber - 1;

    // Scroll to line
    this.editor.scrollToLine(line, true, true, () => {
      // Callback after scroll
    });

    // Select the line
    this.editor.gotoLine(lineNumber, 0, true);

    // Highlight the line temporarily
    const Range = ace.require('ace/range').Range;
    const marker = this.editor.session.addMarker(
      new Range(line, 0, line, 1),
      'ace_active-line',
      'fullLine',
    );

    // Remove highlight after 2 seconds
    setTimeout(() => {
      this.editor?.session.removeMarker(marker);
    }, 2000);
  }
}

customElements.define('nc-code-pane', NCCodePane);
