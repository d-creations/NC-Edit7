import { ServiceRegistry } from '@core/ServiceRegistry';
import { PARSER_SERVICE_TOKEN, EVENT_BUS_TOKEN, STATE_SERVICE_TOKEN } from '@core/ServiceTokens';
import { ParserService } from '@services/ParserService';
import { StateService } from '@services/StateService';
import { EventBus, EVENT_NAMES, EventSubscription } from '@services/EventBus';
import type { ExecutedProgramResult } from '@core/types';
// @ts-expect-error - ACE module doesn't export types correctly
import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';

export class NCCodePane extends HTMLElement {
  private editor?: ace.Ace.Editor;
  private parserService: ParserService;
  private stateService: StateService;
  private eventBus: EventBus;
  private channelId: string = '';
  private resizeObserver?: ResizeObserver;
  private executedLineMarkers: number[] = [];
  private executionSubscription?: EventSubscription;
  private plotClearedSubscription?: EventSubscription;
  private machineChangedSubscription?: EventSubscription;

  constructor() {
    super();
    // ACE editor has issues with Shadow DOM, so we render directly to light DOM
    const registry = ServiceRegistry.getInstance();
    this.parserService = registry.get(PARSER_SERVICE_TOKEN);
    this.stateService = registry.get(STATE_SERVICE_TOKEN);
    this.eventBus = registry.get(EVENT_BUS_TOKEN);
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

    // Listen for execution completed events to highlight executed lines
    this.executionSubscription = this.eventBus.subscribe(
      EVENT_NAMES.EXECUTION_COMPLETED,
      (data: unknown) => {
        const executionData = data as {
          channelId: string;
          result?: ExecutedProgramResult;
        };

        // Only highlight if this is for our channel
        if (executionData.channelId === this.channelId && executionData.result) {
          this.highlightExecutedLines(executionData.result);
        }
      },
    );

    // Listen for plot cleared events to remove executed line highlighting
    this.plotClearedSubscription = this.eventBus.subscribe(EVENT_NAMES.PLOT_CLEARED, () => {
      this.clearExecutedLineMarkers();
    });

    // Listen for machine changes to re-parse with new regex patterns
    this.machineChangedSubscription = this.eventBus.subscribe(EVENT_NAMES.MACHINE_CHANGED, () => {
      this.triggerParse();
    });
  }

  disconnectedCallback() {
    if (this.executionSubscription) {
      this.executionSubscription.unsubscribe();
    }
    if (this.plotClearedSubscription) {
      this.plotClearedSubscription.unsubscribe();
    }
    if (this.machineChangedSubscription) {
      this.machineChangedSubscription.unsubscribe();
    }
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
            background-color: #272822 !important;
            color: #f8f8f2 !important;
        }
        
        /* Layering fixes to ensure text is always on top of markers */
        .ace_marker-layer {
            z-index: 1 !important;
        }
        .ace_text-layer {
            z-index: 2 !important;
            color: #f8f8f2 !important;
        }
        .ace_cursor-layer {
            z-index: 3 !important;
        }
        
        .ace_line {
            /* Allow syntax highlighting to work, but default to white */
            color: inherit;
        }

        .ace_executed-line {
            position: absolute;
            background-color: rgba(0, 128, 0, 0.2) !important;
            border-left: 3px solid #4ec9b0 !important;
        }
        
        /* Improve active line visibility */
        .ace_marker-layer .ace_active-line {
            background-color: #44475a !important;
            border-top: 1px solid #6272a4;
            border-bottom: 1px solid #6272a4;
        }
        .ace_gutter-active-line {
            background-color: #44475a !important;
            color: #f8f8f2 !important;
        }
        .ace_cursor {
            color: #f8f8f2 !important;
            border-left: 2px solid #f8f8f2 !important;
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

    const demoProgram = `G0 X0 Y0
T200
G98
G1 X50 Y0 F200
G1 X50 Y50
G1 X0 Y50
G1 X0 Y0
G0 Z5
G1 X25 Y25
G1 Z0
G1 X75 Y25
G1 Z5`;

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
    this.triggerParse();

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
      this.triggerParse();
    });

    // Listen for cursor changes to highlight corresponding plot segment
    this.editor.selection.on('changeCursor', () => {
      if (!this.editor) return;
      const cursorPosition = this.editor.getCursorPosition();
      // Ace uses 0-based rows, but our NC parser/plotter uses 1-based line numbers
      const lineNumber = cursorPosition.row + 1;
      
      this.eventBus.publish(EVENT_NAMES.EDITOR_CURSOR_MOVED, {
        channelId: this.channelId,
        lineNumber: lineNumber
      });
    });
  }

  private triggerParse() {
    if (!this.editor) return;
    const value = this.editor.getValue();
    const activeMachine = this.stateService.getState().activeMachine;
    const regexPatterns = activeMachine?.regexPatterns;
    
    this.parserService.parse(value, this.channelId, { regexPatterns });
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

  /**
   * Highlights lines in the editor that have been executed/plotted.
   * Called when execution completes to show which lines were processed.
   */
  highlightExecutedLines(result: ExecutedProgramResult): void {
    if (!this.editor) return;

    // Clear previous executed line markers
    this.clearExecutedLineMarkers();

    // Get line numbers from segments if available (more accurate than executedLines)
    const lineNumbers = new Set<number>();

    // Add lines from plotMetadata segments
    if (result.plotMetadata?.segments) {
      result.plotMetadata.segments.forEach((segment) => {
        if (segment.startPoint.lineNumber !== undefined) {
          lineNumbers.add(segment.startPoint.lineNumber);
        }
        if (segment.endPoint.lineNumber !== undefined) {
          lineNumbers.add(segment.endPoint.lineNumber);
        }
      });
    }

    // Also add from executedLines array if available
    if (result.executedLines && result.executedLines.length > 0) {
      result.executedLines.forEach((line) => lineNumbers.add(line));
    }

    // Add markers for each executed line
    const Range = ace.require('ace/range').Range;
    lineNumbers.forEach((lineNumber) => {
      // Convert to 0-based index
      const line = lineNumber - 1;
      if (line >= 0 && line < this.editor!.session.getLength()) {
        const markerId = this.editor!.session.addMarker(
          new Range(line, 0, line, 1),
          'ace_executed-line',
          'fullLine',
          false,
        );
        this.executedLineMarkers.push(markerId);
      }
    });
  }

  /**
   * Clears all executed line markers from the editor.
   */
  clearExecutedLineMarkers(): void {
    if (!this.editor) return;

    this.executedLineMarkers.forEach((markerId) => {
      this.editor?.session.removeMarker(markerId);
    });
    this.executedLineMarkers = [];
  }
}

customElements.define('nc-code-pane', NCCodePane);
