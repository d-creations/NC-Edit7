/**
 * NCCodePane - ACE editor wrapper component
 * Integrates ACE editor with ParserService, markers, and time gutter
 */

import { BaseComponent } from './BaseComponent';
import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS, type ChannelId, type FaultDetail } from '@core/types';
import type { StateService } from '@services/StateService';
import type { ParserService } from '@services/ParserService';
import type { EventBus } from '@services/EventBus';
import ace from 'ace-builds';

// Import ACE modules
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/ext-language_tools';

export class NCCodePane extends BaseComponent {
  private channelId!: ChannelId;
  private editor?: ace.Ace.Editor;
  private stateService!: StateService;
  private parserService!: ParserService;
  private eventBus!: EventBus;
  private parseDebounceTimer?: number;
  private timeGutterSide: 'left' | 'right' = 'right';
  private activeTab: 'program' | 'executed' = 'program';

  static get observedAttributes() {
    return ['channel-id', 'time-gutter-side', 'active-tab'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'channel-id':
        this.channelId = newValue;
        this.loadChannelProgram();
        break;
      case 'time-gutter-side':
        this.timeGutterSide = (newValue as 'left' | 'right') || 'right';
        this.updateTimeGutter();
        break;
      case 'active-tab':
        this.activeTab = (newValue as 'program' | 'executed') || 'program';
        this.switchTab();
        break;
    }
  }

  protected onConnected(): void {
    const registry = getServiceRegistry();
    this.stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    this.parserService = registry.get<ParserService>(SERVICE_TOKENS.ParserService);
    this.eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);

    this.channelId = this.getAttribute('channel-id') || 'channel-1';
    this.timeGutterSide = (this.getAttribute('time-gutter-side') as 'left' | 'right') || 'right';

    this.setupEventListeners();
    this.initializeEditor();
  }

  protected onDisconnected(): void {
    if (this.editor) {
      this.editor.destroy();
    }
    if (this.parseDebounceTimer) {
      window.clearTimeout(this.parseDebounceTimer);
    }
  }

  private setupEventListeners(): void {
    this.eventBus.on('parse:completed', (event) => {
      const payload = event.payload as {
        channelId: ChannelId;
        result: { faultDetected: boolean; faults?: FaultDetail[] };
      };
      if (payload.channelId === this.channelId) {
        this.updateMarkers(payload.result.faults);
      }
    });

    this.eventBus.on('channel:state-changed', (event) => {
      const payload = event.payload as { channelId: ChannelId };
      if (payload.channelId === this.channelId) {
        this.loadChannelProgram();
      }
    });
  }

  private initializeEditor(): void {
    const editorContainer = this.query<HTMLDivElement>('.ace-editor-container');
    if (!editorContainer) return;

    // Initialize ACE editor
    this.editor = ace.edit(editorContainer, {
      mode: 'ace/mode/text',
      theme: 'ace/theme/monokai',
      fontSize: 14,
      showPrintMargin: false,
      highlightActiveLine: true,
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: false,
    });

    // Set up event handlers
    this.editor.on('change', () => {
      this.handleProgramChange();
    });

    this.editor.on('changeSelection', () => {
      this.handleSelectionChange();
    });

    // Load initial program
    this.loadChannelProgram();
  }

  private loadChannelProgram(): void {
    if (!this.editor || !this.channelId) return;

    const channel = this.stateService.getChannel(this.channelId);
    if (channel) {
      const currentValue = this.editor.getValue();
      if (currentValue !== channel.program) {
        this.editor.setValue(channel.program || '', -1); // -1 moves cursor to start
      }
    }
  }

  private handleProgramChange(): void {
    if (!this.editor) return;

    const program = this.editor.getValue();

    // Update channel state
    this.stateService.updateChannel(this.channelId, { program });

    // Debounce parsing
    if (this.parseDebounceTimer) {
      window.clearTimeout(this.parseDebounceTimer);
    }

    this.parseDebounceTimer = window.setTimeout(() => {
      this.parseProgram(program);
    }, 500);
  }

  private async parseProgram(program: string): Promise<void> {
    try {
      const { result, artifacts } = await this.parserService.parse(this.channelId, program);

      // Update channel with parse results
      this.stateService.updateChannel(this.channelId, {
        parseResult: result,
        parseArtifacts: artifacts,
      });
    } catch (error) {
      console.error('Failed to parse program:', error);
    }
  }

  private handleSelectionChange(): void {
    if (!this.editor) return;

    const selection = this.editor.getSelection();
    const cursor = selection.getCursor();

    // Emit selection change event
    this.eventBus.emit({
      type: 'editor:selection-changed',
      timestamp: Date.now(),
      payload: {
        channelId: this.channelId,
        line: cursor.row + 1,
        column: cursor.column,
      },
    });
  }

  private updateMarkers(faults?: FaultDetail[]): void {
    if (!this.editor) return;

    const session = this.editor.getSession();

    // Clear existing markers
    const markers = session.getMarkers(false);
    if (markers) {
      Object.keys(markers).forEach((id) => {
        session.removeMarker(parseInt(id, 10));
      });
    }

    // Clear annotations
    session.clearAnnotations();

    if (!faults || faults.length === 0) return;

    // Add new markers and annotations
    const annotations: ace.Ace.Annotation[] = [];

    faults.forEach((fault) => {
      const row = fault.lineNumber - 1; // ACE uses 0-based indexing

      // Add marker for the line
      const Range = ace.require('ace/range').Range;
      const range = new Range(row, 0, row, Infinity);
      const className = fault.severity === 'ERROR' ? 'ace-error-marker' : 'ace-warning-marker';
      session.addMarker(range, className, 'fullLine', false);

      // Add annotation
      annotations.push({
        row,
        column: fault.column,
        text: fault.message,
        type: fault.severity === 'ERROR' ? 'error' : 'warning',
      });
    });

    session.setAnnotations(annotations);
  }

  private updateTimeGutter(): void {
    // TODO: Implement custom time gutter renderer
    // This will show cycle times on the left or right side
    console.log('Time gutter position:', this.timeGutterSide);
  }

  private switchTab(): void {
    if (!this.editor) return;

    if (this.activeTab === 'executed') {
      // Load executed program
      const channel = this.stateService.getChannel(this.channelId);
      if (channel?.executedResult) {
        // TODO: Load executed program content from server result
        this.editor.setReadOnly(true);
      }
    } else {
      // Load program for editing
      this.editor.setReadOnly(false);
      this.loadChannelProgram();
    }

    this.requestRender();
  }

  /**
   * Scroll to a specific line
   */
  scrollToLine(lineNumber: number): void {
    if (!this.editor) return;

    this.editor.scrollToLine(lineNumber - 1, true, true, () => {
      // Highlight the line temporarily
      this.editor?.gotoLine(lineNumber, 0, true);
    });
  }

  /**
   * Get current program content
   */
  getValue(): string {
    return this.editor?.getValue() || '';
  }

  /**
   * Set program content
   */
  setValue(value: string): void {
    if (this.editor) {
      this.editor.setValue(value, -1);
    }
  }

  protected render(): void {
    this.shadow.innerHTML = '';
    this.shadow.appendChild(this.createStyles(this.getStyles()));

    const container = document.createElement('div');
    container.className = 'nc-code-pane';

    // Tab bar
    const tabBar = this.createTabBar();
    container.appendChild(tabBar);

    // Editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'ace-editor-container';
    container.appendChild(editorContainer);

    this.shadow.appendChild(container);

    // Initialize editor after rendering
    setTimeout(() => {
      if (!this.editor) {
        this.initializeEditor();
      }
    }, 0);
  }

  private createTabBar(): HTMLElement {
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';

    const programTab = document.createElement('button');
    programTab.className = `tab ${this.activeTab === 'program' ? 'active' : ''}`;
    programTab.textContent = 'Program';
    programTab.addEventListener('click', () => {
      this.setAttribute('active-tab', 'program');
    });

    const executedTab = document.createElement('button');
    executedTab.className = `tab ${this.activeTab === 'executed' ? 'active' : ''}`;
    executedTab.textContent = 'Executed';
    executedTab.addEventListener('click', () => {
      this.setAttribute('active-tab', 'executed');
    });

    tabBar.appendChild(programTab);
    tabBar.appendChild(executedTab);

    return tabBar;
  }

  private getStyles(): string {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .nc-code-pane {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: #272822;
      }

      .tab-bar {
        display: flex;
        background: #1e1e1e;
        border-bottom: 1px solid #3e3e42;
      }

      .tab {
        padding: 8px 16px;
        background: transparent;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }

      .tab:hover {
        background: #2a2a2a;
        color: #d4d4d4;
      }

      .tab.active {
        color: #569cd6;
        border-bottom-color: #569cd6;
      }

      .ace-editor-container {
        flex: 1;
        width: 100%;
        height: 100%;
        position: relative;
      }

      /* Custom marker styles */
      :host ::ng-deep .ace-error-marker {
        position: absolute;
        background-color: rgba(255, 0, 0, 0.1);
        border-left: 3px solid #f44336;
      }

      :host ::ng-deep .ace-warning-marker {
        position: absolute;
        background-color: rgba(255, 152, 0, 0.1);
        border-left: 3px solid #ff9800;
      }
    `;
  }
}

// Register the custom element
customElements.define('nc-code-pane', NCCodePane);
