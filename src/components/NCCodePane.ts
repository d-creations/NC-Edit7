import { ServiceRegistry } from '@core/ServiceRegistry';
import { PARSER_SERVICE_TOKEN, EVENT_BUS_TOKEN, STATE_SERVICE_TOKEN } from '@core/ServiceTokens';
import { ParserService } from '@services/ParserService';
import { StateService } from '@services/StateService';
import { EventBus, EVENT_NAMES, EventSubscription } from '@services/EventBus';
import type { ExecutedProgramResult, FaultDetail } from '@core/types';
// @ts-expect-error - ACE module doesn't export types correctly
import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';

// Mobile breakpoint - matches the media query in NCEditorApp.ts
const MOBILE_BREAKPOINT = 768;

export class NCCodePane extends HTMLElement {
  private editor?: ace.Ace.Editor;
  private parserService: ParserService;
  private stateService: StateService;
  private eventBus: EventBus;
  private channelId: string = '';
  private resizeObserver?: ResizeObserver;
  private executedLineMarkers: number[] = [];
  private errorMarkers: number[] = [];
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

          if (executionData.result.errors && executionData.result.errors.length > 0) {
            this.showErrors(executionData.result.errors);
          } else {
            this.clearErrors();
          }
        }
      },
    );

    // Listen for plot cleared events to remove executed line highlighting
    this.plotClearedSubscription = this.eventBus.subscribe(EVENT_NAMES.PLOT_CLEARED, () => {
      this.clearExecutedLineMarkers();
      this.clearErrors();
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

        .ace_error-line {
            position: absolute;
            background-color: rgba(255, 0, 0, 0.2) !important;
            border-bottom: 1px dotted #ff0000 !important;
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
        
        /* Mobile touch support for text selection and copy */
        @media (max-width: 768px) {
          .ace_editor {
            /* Enable text selection on touch devices */
            -webkit-user-select: text !important;
            user-select: text !important;
            /* Prevent zooming interference with selection */
            touch-action: manipulation;
          }
          .ace_content {
            -webkit-user-select: text !important;
            user-select: text !important;
          }
          .ace_text-layer {
            -webkit-user-select: text !important;
            user-select: text !important;
          }
          .ace_scroller {
            /* Improve scrolling behavior on mobile */
            -webkit-overflow-scrolling: touch;
          }
        }
      </style>
      <div class="pane-wrapper" style="display: flex; flex-direction: column; width: 100%; height: 100%;">
        <div class="pane-header" style="height: 20px; background-color: #252526; border-bottom: 1px solid #333; display: flex; flex-shrink: 0; display: none;">
            <div class="editor-header-spacer" style="flex: 1;"></div>
            <div class="timing-header" style="width: 60px; color: #ccc; font-size: 10px; text-align: center; line-height: 20px; border-left: 1px solid #333;">TIME</div>
        </div>
        <div class="pane-body" style="flex: 1; display: flex; position: relative; overflow: hidden;">
            <div class="ace-editor-container" style="flex: 1; position: relative; font-size: 14px; background-color: #272822; color: #f8f8f2; z-index: 1;"></div>
            <div class="timing-gutter" style="width: 60px; background-color: #1e1e1e; border-left: 1px solid #333; overflow: hidden; position: relative; display: none;">
                <div class="timing-content" style="position: absolute; top: 0; left: 0; width: 100%;"></div>
            </div>
        </div>
      </div>
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
T="Mill 1";Tool 1
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

    // Enable native scrolling and better mobile support
    this.editor.setOption('scrollPastEnd', 0.5);
    this.editor.setOption('useWorker', false);

    // Sync scrolling with timing gutter
    this.editor.session.on('changeScrollTop', (scrollTop: number) => {
      const timingContent = this.querySelector('.timing-content') as HTMLElement;
      if (timingContent) {
        timingContent.style.transform = `translateY(-${scrollTop}px)`;
      }
    });

    // Check if mobile and adjust settings for better touch handling
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT || 'ontouchstart' in window;
    if (isMobile) {
      this.editor.setOption('enableMobileMenu', true);
      // Larger font for easier touch interaction on mobile
      this.editor.setFontSize(16);
    }

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
        lineNumber: lineNumber,
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

    // Update timing gutter if timing data is available
    if (result.timingData) {
      this.updateTimingGutter(result.timingData);
    }
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
    this.clearTimingGutter();
  }

  private updateTimingGutter(timingData: Map<number, number>): void {
    if (timingData.size === 0) {
      this.clearTimingGutter();
      return;
    }

    const timingGutter = this.querySelector('.timing-gutter') as HTMLElement;
    const timingContent = this.querySelector('.timing-content') as HTMLElement;
    const paneHeader = this.querySelector('.pane-header') as HTMLElement;
    
    if (!timingGutter || !timingContent || !this.editor) return;

    // Show the gutter and header
    timingGutter.style.display = 'block';
    if (paneHeader) paneHeader.style.display = 'flex';
    
    // Clear existing content
    timingContent.innerHTML = '';
    
    const lineHeight = this.editor.renderer.lineHeight;
    
    timingData.forEach((time, lineNumber) => {
      // Convert to 0-based index
      const lineIndex = lineNumber - 1;
      
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.top = `${lineIndex * lineHeight}px`;
      div.style.right = '5px';
      div.style.height = `${lineHeight}px`;
      div.style.lineHeight = `${lineHeight}px`;
      div.style.fontSize = '10px';
      div.style.color = '#888';
      div.textContent = `${time.toFixed(3)}s`;
      
      timingContent.appendChild(div);
    });
    
    // Trigger resize to adjust editor width/height
    this.editor.resize();
  }

  private clearTimingGutter(): void {
    const timingGutter = this.querySelector('.timing-gutter') as HTMLElement;
    const timingContent = this.querySelector('.timing-content') as HTMLElement;
    const paneHeader = this.querySelector('.pane-header') as HTMLElement;
    
    if (timingGutter) {
      timingGutter.style.display = 'none';
    }
    if (paneHeader) {
      paneHeader.style.display = 'none';
    }
    if (timingContent) {
      timingContent.innerHTML = '';
    }
    
    // Trigger resize to adjust editor width/height
    this.editor?.resize();
  }

  showErrors(errors: FaultDetail[]): void {
    if (!this.editor) return;
    this.clearErrors();

    const annotations: ace.Ace.Annotation[] = [];
    const Range = ace.require('ace/range').Range;

    errors.forEach((error) => {
      const line = error.lineNumber - 1;
      if (line >= 0 && line < this.editor!.session.getLength()) {
        // Add gutter annotation
        annotations.push({
          row: line,
          column: 0,
          text: error.message,
          type: error.severity, // 'error' or 'warning'
        });

        // Add marker
        const markerId = this.editor!.session.addMarker(
          new Range(line, 0, line, 1),
          'ace_error-line',
          'fullLine',
          false,
        );
        this.errorMarkers.push(markerId);
      }
    });

    this.editor.session.setAnnotations(annotations);
  }

  clearErrors(): void {
    if (!this.editor) return;
    this.errorMarkers.forEach((markerId) => {
      this.editor?.session.removeMarker(markerId);
    });
    this.errorMarkers = [];
    this.editor.session.clearAnnotations();
  }
}

customElements.define('nc-code-pane', NCCodePane);
