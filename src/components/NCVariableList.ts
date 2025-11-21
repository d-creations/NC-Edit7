/**
 * NCVariableList - Displays NC variables/registers (1-999)
 */

import { BaseComponent } from './BaseComponent';
import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS, type ChannelId } from '@core/types';
import type { StateService } from '@services/StateService';
import type { EventBus } from '@services/EventBus';

interface VariableEntry {
  register: number;
  value: number;
  updated?: boolean;
}

export class NCVariableList extends BaseComponent {
  private channelId!: ChannelId;
  private stateService!: StateService;
  private eventBus!: EventBus;
  private variables: VariableEntry[] = [];
  private filterText = '';
  private isOpen = false;

  static get observedAttributes() {
    return ['channel-id', 'open'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'channel-id':
        this.channelId = newValue;
        this.loadVariables();
        break;
      case 'open':
        this.isOpen = newValue === 'true';
        this.requestRender();
        break;
    }
  }

  protected onConnected(): void {
    const registry = getServiceRegistry();
    this.stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    this.eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);

    this.channelId = this.getAttribute('channel-id') || 'channel-1';
    this.isOpen = this.getAttribute('open') === 'true';

    this.setupEventListeners();
    this.loadVariables();
  }

  private setupEventListeners(): void {
    this.eventBus.on('parse:completed', (event) => {
      const payload = event.payload as {
        channelId: ChannelId;
        artifacts: { variableSnapshot: { registers: Map<number, number> } };
      };
      if (payload.channelId === this.channelId) {
        this.updateVariables(payload.artifacts.variableSnapshot.registers, false);
      }
    });

    this.eventBus.on('execution:completed', (event) => {
      const payload = event.payload as {
        channelId: ChannelId;
        result: { variableDeltas: { registers: Map<number, number> } };
      };
      if (payload.channelId === this.channelId) {
        this.updateVariables(payload.result.variableDeltas.registers, true);
      }
    });
  }

  private loadVariables(): void {
    if (!this.channelId || !this.stateService) return;

    const channel = this.stateService.getChannel(this.channelId);
    if (channel?.parseArtifacts?.variableSnapshot) {
      this.updateVariables(channel.parseArtifacts.variableSnapshot.registers, false);
    }
  }

  private updateVariables(registers: Map<number, number>, markUpdated: boolean): void {
    const newVariables: VariableEntry[] = [];

    registers.forEach((value, register) => {
      newVariables.push({
        register,
        value,
        updated: markUpdated,
      });
    });

    this.variables = newVariables.sort((a, b) => a.register - b.register);
    this.requestRender();
  }

  private handleFilterChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterText = input.value;
    this.requestRender();
  }

  private handleToggle(): void {
    this.isOpen = !this.isOpen;
    this.setAttribute('open', String(this.isOpen));
  }

  private getFilteredVariables(): VariableEntry[] {
    if (!this.filterText) {
      return this.variables;
    }

    const filter = this.filterText.toLowerCase();
    return this.variables.filter((v) => {
      return v.register.toString().includes(filter) || v.value.toString().includes(filter);
    });
  }

  protected render(): void {
    this.shadow.innerHTML = '';
    this.shadow.appendChild(this.createStyles(this.getStyles()));

    const container = document.createElement('div');
    container.className = `nc-variable-list ${this.isOpen ? 'open' : 'closed'}`;

    // Header with toggle
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.addEventListener('click', () => this.handleToggle());

    const title = document.createElement('span');
    title.textContent = `Variables (${this.variables.length})`;
    header.appendChild(title);

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = this.isOpen ? '▼' : '▲';
    header.appendChild(arrow);

    container.appendChild(header);

    if (this.isOpen) {
      // Filter input
      const filterContainer = document.createElement('div');
      filterContainer.className = 'filter-container';

      const filterInput = document.createElement('input');
      filterInput.type = 'text';
      filterInput.className = 'filter-input';
      filterInput.placeholder = 'Filter variables...';
      filterInput.value = this.filterText;
      filterInput.addEventListener('input', (e) => this.handleFilterChange(e));

      filterContainer.appendChild(filterInput);
      container.appendChild(filterContainer);

      // Variable list
      const filteredVars = this.getFilteredVariables();

      if (filteredVars.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = this.filterText ? 'No variables match filter' : 'No variables defined';
        container.appendChild(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'variable-list';

        // Render in chunks for performance (lazy rendering)
        const visibleCount = Math.min(filteredVars.length, 100);
        for (let i = 0; i < visibleCount; i++) {
          const variable = filteredVars[i];
          if (!variable) continue;

          const item = document.createElement('div');
          item.className = `variable-item ${variable.updated ? 'updated' : ''}`;

          const registerSpan = document.createElement('span');
          registerSpan.className = 'register';
          registerSpan.textContent = `#${variable.register}`;

          const valueSpan = document.createElement('span');
          valueSpan.className = 'value';
          valueSpan.textContent = variable.value.toFixed(3);

          item.appendChild(registerSpan);
          item.appendChild(valueSpan);
          list.appendChild(item);
        }

        if (filteredVars.length > visibleCount) {
          const more = document.createElement('div');
          more.className = 'more-items';
          more.textContent = `... and ${filteredVars.length - visibleCount} more`;
          list.appendChild(more);
        }

        container.appendChild(list);
      }
    }

    this.shadow.appendChild(container);
  }

  private getStyles(): string {
    return `
      :host {
        display: block;
        width: 100%;
      }

      .nc-variable-list {
        width: 100%;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border-top: 1px solid #3e3e42;
      }

      .nc-variable-list.closed {
        max-height: 40px;
      }

      .nc-variable-list.open {
        max-height: 400px;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        cursor: pointer;
        user-select: none;
        font-size: 13px;
        font-weight: 500;
      }

      .panel-header:hover {
        background: #333;
      }

      .arrow {
        font-size: 10px;
        color: #888;
      }

      .filter-container {
        padding: 10px;
        background: #252526;
      }

      .filter-input {
        width: 100%;
        padding: 6px 10px;
        background: #3c3c3c;
        border: 1px solid #555;
        border-radius: 3px;
        color: #d4d4d4;
        font-size: 13px;
        outline: none;
      }

      .filter-input:focus {
        border-color: #569cd6;
      }

      .empty-state {
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 13px;
      }

      .variable-list {
        max-height: 300px;
        overflow-y: auto;
      }

      .variable-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 15px;
        font-size: 13px;
        border-bottom: 1px solid #2d2d30;
      }

      .variable-item:hover {
        background: #2a2d2e;
      }

      .variable-item.updated {
        background: #1a3a1a;
        animation: highlight 2s ease-out;
      }

      @keyframes highlight {
        from {
          background: #2a5a2a;
        }
        to {
          background: #1a3a1a;
        }
      }

      .register {
        font-family: 'Courier New', monospace;
        color: #4ec9b0;
        font-weight: 500;
      }

      .value {
        font-family: 'Courier New', monospace;
        color: #b5cea8;
      }

      .more-items {
        padding: 10px 15px;
        text-align: center;
        color: #888;
        font-size: 12px;
        font-style: italic;
      }
    `;
  }
}

// Register the custom element
customElements.define('nc-variable-list', NCVariableList);
