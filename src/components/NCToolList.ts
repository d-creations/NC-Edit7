/**
 * NCToolList - Displays tool information with Q/R parameters
 */

import { BaseComponent } from './BaseComponent';
import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS, type ChannelId, type ToolRegisterEntry } from '@core/types';
import type { StateService } from '@services/StateService';
import type { EventBus } from '@services/EventBus';

export class NCToolList extends BaseComponent {
  private channelId!: ChannelId;
  private stateService!: StateService;
  private eventBus!: EventBus;
  private tools: ToolRegisterEntry[] = [];

  static get observedAttributes() {
    return ['channel-id'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    if (name === 'channel-id') {
      this.channelId = newValue;
      this.loadTools();
    }
  }

  protected onConnected(): void {
    const registry = getServiceRegistry();
    this.stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    this.eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);

    this.channelId = this.getAttribute('channel-id') || 'channel-1';

    this.setupEventListeners();
    this.loadTools();
  }

  private setupEventListeners(): void {
    this.eventBus.on('parse:completed', (event) => {
      const payload = event.payload as {
        channelId: ChannelId;
        artifacts: { toolRegisters: ToolRegisterEntry[] };
      };
      if (payload.channelId === this.channelId) {
        this.tools = payload.artifacts.toolRegisters;
        this.requestRender();
      }
    });
  }

  private loadTools(): void {
    if (!this.channelId || !this.stateService) return;

    const channel = this.stateService.getChannel(this.channelId);
    if (channel?.parseArtifacts?.toolRegisters) {
      this.tools = channel.parseArtifacts.toolRegisters;
      this.requestRender();
    }
  }

  private handleToolClick(tool: ToolRegisterEntry): void {
    // Emit event to scroll editor to this line
    this.eventBus.emit({
      type: 'tool:clicked',
      timestamp: Date.now(),
      payload: {
        channelId: this.channelId,
        toolNumber: tool.toolNumber,
        lineNumber: tool.lineNumber,
      },
    });
  }

  protected render(): void {
    this.shadow.innerHTML = '';
    this.shadow.appendChild(this.createStyles(this.getStyles()));

    const container = document.createElement('div');
    container.className = 'nc-tool-list';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = `Tools (${this.tools.length})`;
    container.appendChild(header);

    if (this.tools.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No tool changes found';
      container.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'tool-list';

      this.tools.forEach((tool) => {
        const item = document.createElement('div');
        item.className = 'tool-item';
        item.addEventListener('click', () => this.handleToolClick(tool));

        const toolHeader = document.createElement('div');
        toolHeader.className = 'tool-header';

        const toolNumber = document.createElement('span');
        toolNumber.className = 'tool-number';
        toolNumber.textContent = `T${tool.toolNumber}`;

        const lineNumber = document.createElement('span');
        lineNumber.className = 'line-number';
        lineNumber.textContent = `L${tool.lineNumber}`;

        toolHeader.appendChild(toolNumber);
        toolHeader.appendChild(lineNumber);
        item.appendChild(toolHeader);

        // Parameters
        if (tool.qParameter !== undefined || tool.rParameter !== undefined) {
          const params = document.createElement('div');
          params.className = 'tool-params';

          if (tool.qParameter !== undefined) {
            const qParam = document.createElement('span');
            qParam.className = 'param';
            qParam.innerHTML = `<span class="param-name">Q:</span> ${tool.qParameter.toFixed(3)}`;
            params.appendChild(qParam);
          }

          if (tool.rParameter !== undefined) {
            const rParam = document.createElement('span');
            rParam.className = 'param';
            rParam.innerHTML = `<span class="param-name">R:</span> ${tool.rParameter.toFixed(3)}`;
            params.appendChild(rParam);
          }

          item.appendChild(params);
        }

        list.appendChild(item);
      });

      container.appendChild(list);
    }

    this.shadow.appendChild(container);
  }

  private getStyles(): string {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
      }

      .nc-tool-list {
        width: 100%;
        height: 100%;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .panel-header {
        padding: 10px 15px;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        font-weight: 500;
        font-size: 13px;
        text-transform: uppercase;
        color: #888;
      }

      .empty-state {
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 13px;
      }

      .tool-list {
        padding: 5px 0;
      }

      .tool-item {
        padding: 10px 15px;
        border-bottom: 1px solid #2d2d30;
        cursor: pointer;
        transition: background 0.2s;
      }

      .tool-item:hover {
        background: #2a2d2e;
      }

      .tool-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;
      }

      .tool-number {
        font-family: 'Courier New', monospace;
        color: #dcdcaa;
        font-weight: 600;
        font-size: 14px;
      }

      .line-number {
        font-size: 11px;
        color: #858585;
        font-family: 'Courier New', monospace;
      }

      .tool-params {
        display: flex;
        gap: 15px;
        font-size: 12px;
        font-family: 'Courier New', monospace;
      }

      .param {
        color: #ce9178;
      }

      .param-name {
        color: #9cdcfe;
        font-weight: 500;
      }
    `;
  }
}

// Register the custom element
customElements.define('nc-tool-list', NCToolList);
