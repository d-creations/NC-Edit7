// Root Web Component for NC-Edit7 application

import type { ChannelId } from '@core/types';
import { ServiceRegistry } from '@core/ServiceRegistry';
import { STATE_SERVICE_TOKEN, MACHINE_SERVICE_TOKEN, EVENT_BUS_TOKEN } from '@core/ServiceTokens';
import { StateService } from '@services/StateService';
import { MachineService } from '@services/MachineService';
import { EventBus, EVENT_NAMES } from '@services/EventBus';
import './NCChannelPane';
import './NCSyncControls';
import './NCStatusIndicator';
import './NCMachineSelector';
import './NCToolpathPlot';

export class NCEditorApp extends HTMLElement {
  private registry: ServiceRegistry;
  private stateService: StateService;
  private machineService: MachineService;
  private eventBus: EventBus;

  constructor() {
    super();
    this.registry = ServiceRegistry.getInstance();

    // Get services from registry
    this.stateService = this.registry.get(STATE_SERVICE_TOKEN);
    this.machineService = this.registry.get(MACHINE_SERVICE_TOKEN);
    this.eventBus = this.registry.get(EVENT_BUS_TOKEN);
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

        .app-channel-action {
          padding: 4px 12px;
          background: #0e639c;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .app-channel-action:hover {
          background: #1177bb;
        }

        .app-plot-toggle {
          padding: 4px 12px;
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .app-plot-toggle.active {
          background: #0e639c;
          color: #fff;
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

        .app-plot-container {
          width: 0;
          display: none;
          background: #1e1e1e;
          border-left: 1px solid #3e3e42;
          overflow: hidden;
          position: relative;
        }

        .app-plot-container.visible {
          display: flex;
          width: 400px;
          min-width: 200px;
          max-width: 80%;
        }

        .plot-resize-handle {
          width: 6px;
          cursor: ew-resize;
          background: #3e3e42;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .plot-resize-handle:hover {
          background: #0e639c;
        }

        .plot-resize-handle::before {
          content: '⋮';
          color: #888;
          font-size: 14px;
        }

        .plot-resize-handle:hover::before {
          color: #fff;
        }

        .plot-content {
          flex: 1;
          overflow: hidden;
        }

        .plot-hide-bar {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
          width: 16px;
          height: 40px;
          background: #3c3c3c;
          border: 1px solid #555;
          border-left: none;
          border-radius: 0 4px 4px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .plot-hide-bar:hover {
          background: #0e639c;
        }

        .plot-hide-bar::before {
          content: '›';
          color: #d4d4d4;
          font-size: 14px;
          font-weight: bold;
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
          <button class="app-channel-action" id="plot-request">▶️ Plot Active</button>
          <button class="app-plot-toggle" id="plot-toggle">🎯 Plot Panel</button>
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
        <div class="app-plot-container" id="plot-container">
          <div class="plot-resize-handle" id="plot-resize-handle"></div>
          <div class="plot-content">
            <nc-toolpath-plot></nc-toolpath-plot>
          </div>
          <div class="plot-hide-bar" id="plot-hide-bar" title="Hide plot panel"></div>
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
      const button = toggle as HTMLButtonElement;
      const channelId = button.dataset.channel as ChannelId;
      const channel = this.stateService.getChannel(channelId);

      // Set initial button state based on channel's active state
      if (!channel?.active) {
        button.classList.add('inactive');
      }

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

    // Initialize channel display on load
    this.updateChannelDisplay();

    const plotToggle = this.querySelector('#plot-toggle');
    plotToggle?.addEventListener('click', () => {
      const plotContainer = this.querySelector('#plot-container');
      const isVisible = plotContainer?.classList.contains('visible');
      this.setPlotViewerVisible(!isVisible);
    });

    const plotRequest = this.querySelector('#plot-request');
    plotRequest?.addEventListener('click', () => {
      this.setPlotViewerVisible(true);
      this.eventBus.publish(EVENT_NAMES.PLOT_REQUEST, undefined);
    });

    // Hide bar to close the plot panel
    const plotHideBar = this.querySelector('#plot-hide-bar');
    plotHideBar?.addEventListener('click', () => {
      this.setPlotViewerVisible(false);
    });

    // Resize handle for plot panel
    this.setupResizeHandle();
  }

  private setupResizeHandle(): void {
    const resizeHandle = this.querySelector('#plot-resize-handle');
    const plotContainer = this.querySelector('#plot-container') as HTMLElement | null;
    if (!resizeHandle || !plotContainer) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(200, Math.min(startWidth + deltaX, window.innerWidth * 0.8));
      plotContainer.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    resizeHandle.addEventListener('mousedown', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      isResizing = true;
      startX = mouseEvent.clientX;
      startWidth = plotContainer.offsetWidth;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });
  }

  private setPlotViewerVisible(visible: boolean): void {
    const plotContainer = this.querySelector('#plot-container');
    const plotToggle = this.querySelector('#plot-toggle');
    if (!plotContainer || !plotToggle) return;

    if (visible) {
      plotContainer.classList.add('visible');
      plotToggle.classList.add('active');
    } else {
      plotContainer.classList.remove('visible');
      plotToggle.classList.remove('active');
    }

    this.stateService.updateUISettings({ plotViewerOpen: visible });
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
