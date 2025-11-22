import { ServiceRegistry } from '@core/ServiceRegistry';
import { EVENT_BUS_TOKEN } from '@core/ServiceTokens';
import { EventBus, EVENT_NAMES } from '@services/EventBus';
import type { ParseArtifacts, NcParseResult } from '@core/types';

interface VariableEntry {
  register: number;
  value: number;
  modified?: boolean;
}

export class NCVariableList extends HTMLElement {
  private eventBus: EventBus;
  private variables = new Map<number, number>();
  private channelId: string = '';
  private isOpen = false;
  private filterText = '';

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
          this.variables = data.artifacts.variableSnapshot;
          this.updateList();
        }
      },
    );

    // Listen for execution results
    this.eventBus.subscribe(EVENT_NAMES.EXECUTION_COMPLETED, (data: unknown) => {
      const execData = data as {
        channelId: string;
        result: { variableSnapshot: Map<number, number> };
      };
      if (execData.channelId === this.channelId && execData.result?.variableSnapshot) {
        // Mark modified variables
        const oldVariables = new Map(this.variables);
        this.variables = execData.result.variableSnapshot;

        // Update with modification flags
        this.updateList(oldVariables);
      }
    });
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 0;
          overflow: hidden;
          background: #252526;
          color: #d4d4d4;
          font-family: monospace;
          font-size: 12px;
          border-top: 1px solid #3e3e42;
          transition: height 0.3s ease;
        }

        :host([open]) {
          height: 200px;
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px;
          background: #2d2d30;
          border-bottom: 1px solid #3e3e42;
        }

        .drawer-title {
          font-weight: bold;
          color: #569cd6;
        }

        .drawer-controls {
          display: flex;
          gap: 8px;
        }

        .filter-input {
          padding: 2px 8px;
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          border-radius: 3px;
          font-size: 11px;
        }

        .close-button {
          padding: 2px 8px;
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        }

        .close-button:hover {
          background: #4c4c4c;
        }

        .variable-list {
          height: calc(100% - 32px);
          overflow-y: auto;
          padding: 4px;
        }

        .variable-item {
          display: flex;
          justify-content: space-between;
          padding: 2px 8px;
          border-bottom: 1px solid #3e3e42;
        }

        .variable-item:hover {
          background: #2a2d2e;
        }

        .variable-item.modified {
          background: #373310;
        }

        .variable-register {
          color: #dcdcaa;
          min-width: 60px;
        }

        .variable-value {
          color: #b5cea8;
        }

        .empty-message {
          padding: 16px;
          text-align: center;
          color: #858585;
        }
      </style>

      <div class="drawer-header">
        <span class="drawer-title">Variables (1-999)</span>
        <div class="drawer-controls">
          <input type="text" class="filter-input" id="filter" placeholder="Filter (e.g., 100-200)">
          <button class="close-button" id="close">Close</button>
        </div>
      </div>
      <div class="variable-list" id="list"></div>
    `;

    this.attachControlListeners();
  }

  private attachControlListeners() {
    const closeButton = this.shadowRoot?.getElementById('close');
    closeButton?.addEventListener('click', () => this.toggle());

    const filterInput = this.shadowRoot?.getElementById('filter') as HTMLInputElement;
    filterInput?.addEventListener('input', (e) => {
      this.filterText = (e.target as HTMLInputElement).value;
      this.updateList();
    });
  }

  private updateList(oldVariables?: Map<number, number>) {
    const list = this.shadowRoot?.getElementById('list');
    if (!list) return;

    list.innerHTML = '';

    if (this.variables.size === 0) {
      list.innerHTML = '<div class="empty-message">No variables detected</div>';
      return;
    }

    // Convert to sorted array
    const entries: VariableEntry[] = Array.from(this.variables.entries())
      .map(([register, value]) => ({
        register,
        value,
        modified: oldVariables ? oldVariables.get(register) !== value : false,
      }))
      .sort((a, b) => a.register - b.register);

    // Apply filter
    let filtered = entries;
    if (this.filterText) {
      filtered = this.applyFilter(entries, this.filterText);
    }

    // Render items (lazy rendering for large lists)
    const maxVisible = 100;
    const toRender = filtered.slice(0, maxVisible);

    toRender.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'variable-item';
      if (entry.modified) {
        item.classList.add('modified');
      }

      item.innerHTML = `
        <span class="variable-register">R${entry.register}</span>
        <span class="variable-value">${entry.value.toFixed(4)}</span>
      `;

      list.appendChild(item);
    });

    if (filtered.length > maxVisible) {
      const moreMessage = document.createElement('div');
      moreMessage.className = 'empty-message';
      moreMessage.textContent = `... and ${filtered.length - maxVisible} more`;
      list.appendChild(moreMessage);
    }
  }

  private applyFilter(entries: VariableEntry[], filter: string): VariableEntry[] {
    // Support range filters like "100-200" or exact matches like "100"
    const rangeMatch = filter.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      return entries.filter((e) => e.register >= start && e.register <= end);
    }

    const exactMatch = filter.match(/^\d+$/);
    if (exactMatch) {
      const num = parseInt(filter);
      return entries.filter((e) => e.register === num);
    }

    // Text search
    return entries.filter((e) => e.register.toString().includes(filter));
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }

  open() {
    this.isOpen = true;
    this.setAttribute('open', '');
  }

  close() {
    this.isOpen = false;
    this.removeAttribute('open');
  }
}

customElements.define('nc-variable-list', NCVariableList);
