import { ServiceRegistry } from '@core/ServiceRegistry';
import { EVENT_BUS_TOKEN } from '@core/ServiceTokens';
import { EventBus, EVENT_NAMES } from '@services/EventBus';
import type { ParseArtifacts, NcParseResult, ToolRegisterEntry } from '@core/types';

export class NCToolList extends HTMLElement {
  private eventBus: EventBus;
  private tools: ToolRegisterEntry[] = [];
  private channelId: string = '';

  static get observedAttributes() {
    return ['channel-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.eventBus = ServiceRegistry.getInstance().get(EVENT_BUS_TOKEN);
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'channel-id') {
      this.channelId = newValue;
    }
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for parse results
    this.eventBus.subscribe(
      EVENT_NAMES.PARSE_COMPLETED,
      (data: { channelId: string; result: NcParseResult; artifacts: ParseArtifacts }) => {
        if (data.channelId === this.channelId) {
          this.tools = data.artifacts.toolRegisters;
          this.updateList();
        }
      },
    );
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          overflow-y: auto;
          background: #252526;
          color: #d4d4d4;
          font-family: monospace;
          font-size: 12px;
        }

        .tool-header {
          padding: 4px 8px;
          background: #2d2d30;
          border-bottom: 1px solid #3e3e42;
          font-weight: bold;
          color: #569cd6;
        }

        .tool-list {
          padding: 4px;
        }

        .tool-item {
          padding: 4px 8px;
          border-bottom: 1px solid #3e3e42;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tool-item:hover {
          background: #2a2d2e;
        }

        .tool-number {
          color: #dcdcaa;
          font-weight: bold;
        }

        .tool-params {
          display: flex;
          gap: 8px;
          font-size: 11px;
        }

        .tool-param {
          color: #b5cea8;
        }

        .empty-message {
          padding: 16px;
          text-align: center;
          color: #858585;
          font-size: 11px;
        }
      </style>

      <div class="tool-header">Tools</div>
      <div class="tool-list" id="list"></div>
    `;
  }

  private updateList() {
    const list = this.shadowRoot?.getElementById('list');
    if (!list) return;

    list.innerHTML = '';

    if (this.tools.length === 0) {
      list.innerHTML = '<div class="empty-message">No tools detected</div>';
      return;
    }

    this.tools.forEach((tool) => {
      const item = document.createElement('div');
      item.className = 'tool-item';

      const params = [];
      if (tool.qParameter !== undefined) {
        params.push(`<span class="tool-param">Q: ${tool.qParameter}</span>`);
      }
      if (tool.rParameter !== undefined) {
        params.push(`<span class="tool-param">R: ${tool.rParameter}</span>`);
      }

      item.innerHTML = `
        <span class="tool-number">T${tool.toolNumber}</span>
        <div class="tool-params">
          ${params.join('') || '<span class="tool-param">-</span>'}
        </div>
      `;

      list.appendChild(item);
    });
  }
}

customElements.define('nc-tool-list', NCToolList);
