// Root Web Component for NC-Edit7 application

import type { ChannelId, MachineType } from '@core/types';
import { ServiceRegistry } from '@core/ServiceRegistry';
import { StateService } from '@services/StateService';
import { MachineService } from '@services/MachineService';

export class NCEditorApp extends HTMLElement {
  private registry: ServiceRegistry;
  private stateService: StateService;
  private machineService: MachineService;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.registry = ServiceRegistry.getInstance();
    
    // Get services from registry
    this.stateService = this.registry.get(Symbol.for('StateService')) as StateService;
    this.machineService = this.registry.get(Symbol.for('MachineService')) as MachineService;
  }

  async connectedCallback(): Promise<void> {
    await this.render();
    await this.init();
  }

  private async init(): Promise<void> {
    try {
      // Initialize machine service
      await this.machineService.init();
      
      // Set up initial machine
      const machines = this.machineService.getMachines();
      if (machines.length > 0) {
        this.stateService.setMachines(machines);
        this.stateService.setGlobalMachine(machines[0].machineName);
      }

      this.updateMachineSelector();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to initialize application');
    }
  }

  private async render(): Promise<void> {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #1e1e1e;
          color: #d4d4d4;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 8px 16px;
          background: #252526;
          border-bottom: 1px solid #3e3e42;
        }

        .title {
          font-size: 18px;
          font-weight: 600;
          color: #569cd6;
        }

        .machine-selector {
          padding: 4px 8px;
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          border-radius: 4px;
          cursor: pointer;
        }

        .channel-controls {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .channel-toggle {
          padding: 4px 12px;
          background: #0e639c;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .channel-toggle.inactive {
          background: #3c3c3c;
          color: #888;
        }

        .main-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .sidebar {
          width: 250px;
          background: #252526;
          border-right: 1px solid #3e3e42;
          overflow-y: auto;
        }

        .channel-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .channels {
          display: flex;
          flex: 1;
          gap: 4px;
          padding: 4px;
          overflow: hidden;
        }

        .channel-pane {
          flex: 1;
          background: #1e1e1e;
          border: 1px solid #3e3e42;
          border-radius: 4px;
          display: flex;
          flex-direction: column;
        }

        .channel-header {
          padding: 8px;
          background: #2d2d30;
          border-bottom: 1px solid #3e3e42;
          font-size: 12px;
          font-weight: 600;
        }

        .channel-editor {
          flex: 1;
          overflow: hidden;
          padding: 8px;
        }

        .status-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 4px 16px;
          background: #007acc;
          color: #fff;
          font-size: 12px;
        }

        .error-message {
          padding: 16px;
          background: #f48771;
          color: #1e1e1e;
          margin: 8px;
          border-radius: 4px;
        }
      </style>

      <div class="header">
        <span class="title">NC-Edit7</span>
        <select class="machine-selector" id="machine-selector">
          <option value="">Select Machine...</option>
        </select>
        <div class="channel-controls">
          <button class="channel-toggle" data-channel="1">Channel 1</button>
          <button class="channel-toggle" data-channel="2">Channel 2</button>
          <button class="channel-toggle" data-channel="3">Channel 3</button>
        </div>
      </div>

      <div class="main-content">
        <div class="sidebar">
          <div style="padding: 16px;">
            <h3 style="margin-bottom: 8px; font-size: 14px;">Tools & Keywords</h3>
            <div id="keyword-list">No program loaded</div>
          </div>
        </div>

        <div class="channel-container">
          <div class="channels" id="channels">
            <div class="channel-pane" data-channel="1">
              <div class="channel-header">Channel 1</div>
              <div class="channel-editor">
                <textarea 
                  style="width: 100%; height: 100%; background: #1e1e1e; color: #d4d4d4; border: none; font-family: 'Consolas', monospace; resize: none;"
                  placeholder="Enter NC program here..."
                  data-channel="1"
                ></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="status-bar">
        <span>Ready</span>
        <span id="status-details"></span>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Machine selector
    const selector = this.shadowRoot?.querySelector('#machine-selector') as HTMLSelectElement;
    selector?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const machineType = target.value as MachineType;
      if (machineType) {
        this.stateService.setGlobalMachine(machineType);
      }
    });

    // Channel toggles
    const toggles = this.shadowRoot?.querySelectorAll('.channel-toggle');
    toggles?.forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        const button = e.target as HTMLButtonElement;
        const channelId = button.dataset.channel as ChannelId;
        const channel = this.stateService.getChannel(channelId);
        
        if (channel?.active) {
          this.stateService.deactivateChannel(channelId);
          button.classList.add('inactive');
        } else {
          this.stateService.activateChannel(channelId);
          button.classList.remove('inactive');
        }
        
        this.updateChannelDisplay();
      });
    });
  }

  private updateMachineSelector(): void {
    const selector = this.shadowRoot?.querySelector('#machine-selector') as HTMLSelectElement;
    if (!selector) return;

    const machines = this.machineService.getMachines();
    selector.innerHTML = '<option value="">Select Machine...</option>';
    
    machines.forEach((machine) => {
      const option = document.createElement('option');
      option.value = machine.machineName;
      option.textContent = machine.machineName;
      selector.appendChild(option);
    });
  }

  private updateChannelDisplay(): void {
    const channelsContainer = this.shadowRoot?.querySelector('#channels');
    if (!channelsContainer) return;

    const activeChannels = this.stateService.getActiveChannels();
    
    // Hide all channel panes first
    const panes = this.shadowRoot?.querySelectorAll('.channel-pane');
    panes?.forEach((pane) => {
      (pane as HTMLElement).style.display = 'none';
    });

    // Show active channels
    activeChannels.forEach((channel) => {
      const pane = this.shadowRoot?.querySelector(`[data-channel="${channel.id}"]`);
      if (pane) {
        (pane as HTMLElement).style.display = 'flex';
      }
    });
  }

  private showError(message: string): void {
    const mainContent = this.shadowRoot?.querySelector('.main-content');
    if (!mainContent) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    mainContent.prepend(errorDiv);
  }
}

customElements.define('nc-editor-app', NCEditorApp);
