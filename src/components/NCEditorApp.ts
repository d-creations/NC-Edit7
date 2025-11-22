// Root Web Component for NC-Edit7 application

import type { ChannelId } from '@core/types';
import { ServiceRegistry } from '@core/ServiceRegistry';
import { STATE_SERVICE_TOKEN, MACHINE_SERVICE_TOKEN } from '@core/ServiceTokens';
import { StateService } from '@services/StateService';
import { MachineService } from '@services/MachineService';
import './NCChannelPane';
import './NCSyncControls';
import './NCStatusIndicator';
import './NCMachineSelector';

export class NCEditorApp extends HTMLElement {
  private registry: ServiceRegistry;
  private stateService: StateService;
  private machineService: MachineService;

  constructor() {
    super();
    this.registry = ServiceRegistry.getInstance();

    // Get services from registry
    this.stateService = this.registry.get(STATE_SERVICE_TOKEN);
    this.machineService = this.registry.get(MACHINE_SERVICE_TOKEN);
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
      
      // No need to update selector manually, component handles it
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to initialize application');
    }
  }

  private async render(): Promise<void> {
    this.innerHTML = `
      <style>
        nc-editor-app {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #1e1e1e;
          color: #d4d4d4;
        }

        .app-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 8px 16px;
          background: #252526;
          border-bottom: 1px solid #3e3e42;
        }

        .app-title {
          font-size: 18px;
          font-weight: 600;
          color: #569cd6;
        }

        .app-channel-controls {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .app-channel-toggle {
          padding: 4px 12px;
          background: #0e639c;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .app-channel-toggle.inactive {
          background: #3c3c3c;
          color: #888;
        }

        .app-main-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .app-sidebar {
          width: 250px;
          background: #252526;
          border-right: 1px solid #3e3e42;
          overflow-y: auto;
        }

        .app-channel-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .app-channels {
          display: flex;
          flex: 1;
          gap: 4px;
          padding: 4px;
          overflow: hidden;
        }

        nc-channel-pane {
          display: none;
        }

        .app-status-bar {
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

      <div class="app-header">
        <span class="app-title">NC-Edit7</span>
        <nc-machine-selector></nc-machine-selector>
        <div class="app-channel-controls">
          <button class="app-channel-toggle" data-channel="1">Channel 1</button>
          <button class="app-channel-toggle" data-channel="2">Channel 2</button>
          <button class="app-channel-toggle" data-channel="3">Channel 3</button>
        </div>
      </div>

      <div class="app-main-content">
        <div class="app-channel-container">
          <div class="app-channels" id="channels">
            <nc-channel-pane channel-id="1" data-channel="1"></nc-channel-pane>
            <nc-channel-pane channel-id="2" data-channel="2"></nc-channel-pane>
            <nc-channel-pane channel-id="3" data-channel="3"></nc-channel-pane>
          </div>
        </div>
      </div>

      <div class="app-status-bar">
        <nc-status-indicator></nc-status-indicator>
        <span id="status-details"></span>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Channel toggles
    const toggles = this.querySelectorAll('.app-channel-toggle');
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

  private updateChannelDisplay(): void {
    const channelsContainer = this.querySelector('#channels');
    if (!channelsContainer) return;

    const activeChannels = this.stateService.getActiveChannels();

    // Hide all channel panes first
    const panes = this.querySelectorAll('nc-channel-pane');
    panes?.forEach((pane) => {
      (pane as HTMLElement).style.display = 'none';
    });

    // Show active channels
    activeChannels.forEach((channel) => {
      const pane = this.querySelector(`nc-channel-pane[data-channel="${channel.id}"]`);
      if (pane) {
        (pane as HTMLElement).style.display = 'flex';
      }
    });
  }

  private showError(message: string): void {
    const mainContent = this.querySelector('.app-main-content');
    if (!mainContent) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    mainContent.prepend(errorDiv);
  }
}


customElements.define('nc-editor-app', NCEditorApp);
