/**
 * NCEditorApp - Root application component
 */

import { BaseComponent } from './BaseComponent';
import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS, type ChannelId, type ChannelState } from '@core/types';
import type { StateService } from '@services/StateService';
import type { MachineService } from '@services/MachineService';
import type { EventBus } from '@services/EventBus';
import './NCCodePane';
import './NCKeywordPanel';
import './NCVariableList';
import './NCToolList';
import './NCToolpathPlot';

/**
 * Root component that bootstraps the application layout
 */
export class NCEditorApp extends BaseComponent {
  private stateService!: StateService;
  private machineService!: MachineService;
  private eventBus!: EventBus;
  private channelIds: ChannelId[] = ['channel-1', 'channel-2', 'channel-3'];
  private channelStateCache = new Map<ChannelId, ChannelState>();
  private plotPanelWidth = 450;
  private readonly plotPanelMinWidth = 320;
  private readonly plotPanelMaxWidth = 900;
  private plotPanelVisible = true;
  private plotWrapperElement?: HTMLElement;
  private mainContentElement?: HTMLElement;

  protected onConnected(): void {
    // Get services from registry
    const registry = getServiceRegistry();
    this.stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    this.machineService = registry.get<MachineService>(SERVICE_TOKENS.MachineService);
    this.eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);

    // Subscribe to events
    this.setupEventListeners();

    // Initialize channels (will also load machines)
    this.initializeChannels();
  }

  private async initializeChannels(): Promise<void> {
    // Wait for machines to be loaded first
    await this.loadMachines();

    // Demo NC programs for channels
    const demoPrograms = {
      'channel-1': `G90 G54
G0 X0 Y0 Z10
M3 S1000
G1 Z-5 F100
G1 X50 Y0 F300
G1 X50 Y50
G1 X0 Y50
G1 X0 Y0
G0 Z10
M5
M30`,
      'channel-2': `G90 G55
G0 X100 Y100 Z20
M3 S1500
T1
G1 Z-10 F150
G2 X120 Y120 I20 J0 F250
G1 X100 Y100
G0 Z20
M5
M30`,
    };

    // Create default channels
    for (const channelId of this.channelIds) {
      try {
        this.stateService.createChannel(channelId);
        // Activate first TWO channels by default for demo
        if (channelId === 'channel-1' || channelId === 'channel-2') {
          this.stateService.activateChannel(channelId);

          // Set demo program
          const program = demoPrograms[channelId as keyof typeof demoPrograms] || '';
          if (program) {
            this.stateService.updateChannel(channelId, { program });
          }
        }
      } catch (error) {
        console.error(`Failed to create channel ${channelId}:`, error);
      }
    }

    this.requestRender();
  }

  private setupEventListeners(): void {
    // Listen for state changes
    this.eventBus.on('channel:state-changed', (event) => {
      const payload = event.payload as {
        channelId: ChannelId;
        state: ChannelState;
      };

      const prevState = this.channelStateCache.get(payload.channelId);
      this.channelStateCache.set(payload.channelId, this.cloneChannelState(payload.state));

      if (this.shouldRenderForChannelStateChange(prevState, payload.state)) {
        this.requestRender();
      }
    });

    this.eventBus.on('machine:changed', () => {
      this.requestRender();
    });
  }

  private async loadMachines(): Promise<void> {
    try {
      await this.machineService.fetchMachines();
      const machines = this.machineService.getAllMachines();

      // Register machines with state service
      for (const machine of machines) {
        this.stateService.registerMachine(machine);
      }

      // Set default global machine if available
      if (machines.length > 0) {
        this.stateService.setGlobalMachine(machines[0]!.id);
      }

      this.requestRender();
    } catch (error) {
      console.warn('Failed to load machines from server, using mock data:', error);

      // Create mock machines for development/demo
      const mockMachines = [
        {
          id: 'ISO_MILL',
          name: 'ISO_MILL',
          controlType: 'MILL' as const,
          availableChannels: 2,
          axes: [
            {
              name: 'X',
              type: 'LINEAR' as const,
              minPosition: -500,
              maxPosition: 500,
              units: 'MM' as const,
            },
            {
              name: 'Y',
              type: 'LINEAR' as const,
              minPosition: -500,
              maxPosition: 500,
              units: 'MM' as const,
            },
            {
              name: 'Z',
              type: 'LINEAR' as const,
              minPosition: -300,
              maxPosition: 300,
              units: 'MM' as const,
            },
          ],
          feedLimits: {
            minFeed: 1,
            maxFeed: 5000,
            rapidFeed: 20000,
            units: 'MM_PER_MIN' as const,
          },
          defaultTools: [],
        },
        {
          id: 'FANUC_T',
          name: 'FANUC_T',
          controlType: 'TURN' as const,
          availableChannels: 1,
          axes: [
            {
              name: 'X',
              type: 'LINEAR' as const,
              minPosition: -200,
              maxPosition: 200,
              units: 'MM' as const,
            },
            {
              name: 'Z',
              type: 'LINEAR' as const,
              minPosition: -500,
              maxPosition: 0,
              units: 'MM' as const,
            },
          ],
          feedLimits: {
            minFeed: 1,
            maxFeed: 3000,
            rapidFeed: 15000,
            units: 'MM_PER_MIN' as const,
          },
          defaultTools: [],
        },
      ];

      for (const machine of mockMachines) {
        this.stateService.registerMachine(machine);
      }

      if (mockMachines.length > 0) {
        this.stateService.setGlobalMachine(mockMachines[0]!.id);
      }

      this.requestRender();
    }
  }

  protected render(): void {
    // Safety check - ensure services are initialized
    if (!this.stateService) {
      this.shadow.innerHTML = '<div style="padding: 20px; color: #888;">Initializing...</div>';
      return;
    }

    const channels = this.stateService.getAllChannels();
    const machines = this.stateService.getAllMachines();
    const globalMachine = this.stateService.getGlobalMachine();

    this.shadow.innerHTML = '';

    // Add styles
    this.shadow.appendChild(this.createStyles(this.getStyles()));

    // Create container
    const container = document.createElement('div');
    container.className = 'nc-editor-app';

    // Top bar
    const topBar = this.createTopBar(machines, globalMachine);
    container.appendChild(topBar);

    // Main content area
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    this.mainContentElement = mainContent;

    // Channel task list
    const taskList = this.createChannelTaskList(channels);
    mainContent.appendChild(taskList);

    const channelArea = document.createElement('div');
    channelArea.className = 'channel-area';
    const channelGrid = this.createChannelGrid(channels);
    channelArea.appendChild(channelGrid);
    mainContent.appendChild(channelArea);

    const plotResizer = document.createElement('div');
    plotResizer.className = 'plot-resizer';
    plotResizer.addEventListener('mousedown', (event) => this.startPlotResize(event));

    const plotToggle = document.createElement('button');
    plotToggle.type = 'button';
    plotToggle.className = 'plot-toggle';
    plotToggle.textContent = this.plotPanelVisible ? 'Hide plot ≡' : 'Show plot ≡';
    plotToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      this.plotPanelVisible = !this.plotPanelVisible;
      this.requestRender();
    });
    plotResizer.appendChild(plotToggle);
    mainContent.appendChild(plotResizer);

    const plotWrapper = document.createElement('div');
    plotWrapper.className = 'plot-wrapper';
    if (!this.plotPanelVisible) {
      plotWrapper.classList.add('collapsed');
    }
    plotWrapper.style.width = this.plotPanelVisible ? `${this.plotPanelWidth}px` : '0';
    this.plotWrapperElement = plotWrapper;

    const plotArea = document.createElement('nc-toolpath-plot');
    plotArea.className = 'plot-area';
    plotWrapper.appendChild(plotArea);
    mainContent.appendChild(plotWrapper);

    container.appendChild(mainContent);

    // Status bar
    const statusBar = this.createStatusBar();
    container.appendChild(statusBar);

    this.shadow.appendChild(container);

    this.cacheInitialChannelStates(channels);
  }

  private createTopBar(
    machines: ReturnType<typeof this.stateService.getAllMachines>,
    globalMachine?: string
  ): HTMLElement {
    const topBar = document.createElement('div');
    topBar.className = 'top-bar';

    const title = document.createElement('h1');
    title.textContent = 'NC-Edit7';
    topBar.appendChild(title);

    // Machine selector
    const machineSelector = document.createElement('div');
    machineSelector.className = 'machine-selector';

    const label = document.createElement('label');
    label.textContent = 'Machine: ';
    machineSelector.appendChild(label);

    const select = document.createElement('select');
    select.className = 'machine-select';

    for (const machine of machines) {
      const option = document.createElement('option');
      option.value = machine.id;
      option.textContent = `${machine.name} (${machine.controlType})`;
      option.selected = machine.id === globalMachine;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      if (select.value) {
        this.stateService.setGlobalMachine(select.value);
      }
    });

    machineSelector.appendChild(select);
    topBar.appendChild(machineSelector);

    return topBar;
  }

  private createChannelTaskList(
    channels: ReturnType<typeof this.stateService.getAllChannels>
  ): HTMLElement {
    const taskList = document.createElement('div');
    taskList.className = 'channel-task-list';

    const title = document.createElement('h3');
    title.textContent = 'Channels';
    taskList.appendChild(title);

    const list = document.createElement('div');
    list.className = 'channel-toggles';

    for (const channel of channels) {
      const toggle = document.createElement('label');
      toggle.className = 'channel-toggle';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = channel.isActive;
      checkbox.addEventListener('change', () => {
        this.stateService.toggleChannel(channel.id);
      });

      const span = document.createElement('span');
      span.textContent = channel.id;

      toggle.appendChild(checkbox);
      toggle.appendChild(span);
      list.appendChild(toggle);
    }

    taskList.appendChild(list);
    return taskList;
  }

  private shouldRenderForChannelStateChange(
    prevState: ChannelState | undefined,
    nextState: ChannelState
  ): boolean {
    if (!prevState) {
      return true;
    }

    if (prevState.isActive !== nextState.isActive) {
      return true;
    }

    if (prevState.machineId !== nextState.machineId) {
      return true;
    }

    if (prevState.executedResult !== nextState.executedResult) {
      return true;
    }

    if (!this.areUiConfigsEqual(prevState.uiConfig, nextState.uiConfig)) {
      return true;
    }

    return false;
  }

  private areUiConfigsEqual(a: ChannelState['uiConfig'], b: ChannelState['uiConfig']): boolean {
    return (
      a.keywordPanelSide === b.keywordPanelSide &&
      a.timeGutterSide === b.timeGutterSide &&
      a.variableDrawerOpen === b.variableDrawerOpen &&
      a.toolOverlayOpen === b.toolOverlayOpen &&
      a.activeTab === b.activeTab
    );
  }

  private cacheInitialChannelStates(channels: ChannelState[]): void {
    for (const channel of channels) {
      this.channelStateCache.set(channel.id, this.cloneChannelState(channel));
    }
  }

  private cloneChannelState(state: ChannelState): ChannelState {
    return {
      ...state,
      uiConfig: { ...state.uiConfig },
    };
  }

  private createChannelGrid(
    channels: ReturnType<typeof this.stateService.getAllChannels>
  ): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'channel-grid';

    const activeChannels = channels.filter((ch) => ch.isActive);

    if (activeChannels.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder';
      placeholder.textContent = 'No channels active. Enable channels from the task list.';
      grid.appendChild(placeholder);
    } else {
      for (const channel of activeChannels) {
        const channelPane = this.createChannelPane(channel);
        grid.appendChild(channelPane);
      }
    }

    return grid;
  }

  private createChannelPane(
    channel: ReturnType<typeof this.stateService.getAllChannels>[0]
  ): HTMLElement {
    const pane = document.createElement('div');
    pane.className = 'channel-pane';
    pane.dataset.channelId = channel.id;

    const header = document.createElement('div');
    header.className = 'channel-header';
    header.textContent = `${channel.id} - ${channel.machineId}`;
    pane.appendChild(header);

    const contentArea = document.createElement('div');
    contentArea.className = 'channel-content';

    // Left panel (keywords and tools)
    const leftPanel = document.createElement('div');
    leftPanel.className = 'left-panel';

    const keywordPanel = document.createElement('nc-keyword-panel');
    keywordPanel.setAttribute('channel-id', channel.id);
    keywordPanel.style.flex = '1';
    keywordPanel.style.minHeight = '0';
    leftPanel.appendChild(keywordPanel);

    const toolList = document.createElement('nc-tool-list');
    toolList.setAttribute('channel-id', channel.id);
    toolList.style.flex = '1';
    toolList.style.minHeight = '0';
    leftPanel.appendChild(toolList);

    contentArea.appendChild(leftPanel);

    // Center editor area
    const editorArea = document.createElement('div');
    editorArea.className = 'editor-area';

    const codePane = document.createElement('nc-code-pane');
    codePane.setAttribute('channel-id', channel.id);
    codePane.setAttribute('active-tab', channel.uiConfig.activeTab);
    codePane.style.flex = '1';
    editorArea.appendChild(codePane);

    // Variable drawer at bottom
    const variableList = document.createElement('nc-variable-list');
    variableList.setAttribute('channel-id', channel.id);
    variableList.setAttribute('open', String(channel.uiConfig.variableDrawerOpen));
    editorArea.appendChild(variableList);

    contentArea.appendChild(editorArea);
    pane.appendChild(contentArea);

    return pane;
  }

  private createStatusBar(): HTMLElement {
    const statusBar = document.createElement('div');
    statusBar.className = 'status-bar';
    statusBar.textContent = 'Ready';
    return statusBar;
  }

  private startPlotResize(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    this.plotPanelVisible = true;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.mainContentElement) {
        return;
      }

      const mainRect = this.mainContentElement.getBoundingClientRect();
      const newWidth = mainRect.right - moveEvent.clientX;
      this.setPlotPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private setPlotPanelWidth(width: number): void {
    const clamped = Math.max(this.plotPanelMinWidth, Math.min(this.plotPanelMaxWidth, width));
    this.plotPanelWidth = clamped;
    if (this.plotWrapperElement) {
      this.plotWrapperElement.style.width = `${clamped}px`;
      this.plotWrapperElement.classList.remove('collapsed');
    }
  }

  private getStyles(): string {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .nc-editor-app {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 20px;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
      }

      .top-bar h1 {
        font-size: 20px;
        margin: 0;
        color: #569cd6;
      }

      .machine-selector {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .machine-select {
        padding: 5px 10px;
        background: #3c3c3c;
        color: #d4d4d4;
        border: 1px solid #555;
        border-radius: 3px;
        font-size: 14px;
        cursor: pointer;
      }

      .main-content {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      .channel-task-list {
        width: 200px;
        padding: 15px;
        background: #252526;
        border-right: 1px solid #3e3e42;
        overflow-y: auto;
      }

      .channel-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .channel-task-list h3 {
        margin: 0 0 15px 0;
        font-size: 14px;
        text-transform: uppercase;
        color: #888;
      }

      .channel-toggles {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .channel-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 5px;
        border-radius: 3px;
        transition: background 0.2s;
      }

      .channel-toggle:hover {
        background: #2a2d2e;
      }

      .channel-toggle input[type="checkbox"] {
        cursor: pointer;
      }

      .channel-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 15px;
        flex: 1;
        padding: 15px;
        overflow: auto;
      }

      .channel-pane {
        background: #1e1e1e;
        border: 1px solid #3e3e42;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        min-height: 400px;
        overflow: hidden;
      }

      .channel-header {
        padding: 10px 15px;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        font-weight: 500;
      }

      .channel-content {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      .left-panel {
        width: 250px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #3e3e42;
        overflow: hidden;
      }

      .editor-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #888;
        font-size: 16px;
      }

      .plot-resizer {
        width: 32px;
        min-width: 32px;
        cursor: ew-resize;
        background: #151515;
        display: flex;
        align-items: center;
        justify-content: center;
        border-left: 1px solid #3e3e42;
        border-right: 1px solid #3e3e42;
        position: relative;
      }

      .plot-toggle {
        background: #2d2d30;
        border: 1px solid #3e3e42;
        border-radius: 4px;
        color: #d4d4d4;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
      }

      .plot-resizer:hover .plot-toggle {
        background: #3c3c3c;
      }

      .plot-wrapper {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: width 0.2s ease;
        flex-shrink: 0;
      }

      .plot-wrapper.collapsed {
        width: 0 !important;
      }

      .plot-area {
        flex: 1;
        min-width: 300px;
        background: #252526;
        border-left: 1px solid #3e3e42;
      }

      .status-bar {
        padding: 5px 20px;
        background: #007acc;
        color: white;
        font-size: 12px;
        border-top: 1px solid #3e3e42;
      }
    `;
  }
}

// Register the custom element
customElements.define('nc-editor-app', NCEditorApp);
