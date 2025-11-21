/**
 * StateService - Central state management for the application
 */

import type {
  AppState,
  ChannelId,
  ChannelState,
  MachineId,
  MachineProfile,
  UserSettings,
  ChannelStateChangedEvent,
  MachineChangedEvent,
} from '@core/types';
import type { EventBus } from './EventBus';

/**
 * StateService provides centralized state management with immutable snapshots
 * and event notifications on changes
 */
export class StateService {
  private state: AppState;

  constructor(private eventBus: EventBus) {
    this.state = this.createInitialState();
  }

  private createInitialState(): AppState {
    return {
      machines: new Map(),
      channels: new Map(),
      activeChannels: [],
      settings: this.createDefaultSettings(),
    };
  }

  private createDefaultSettings(): UserSettings {
    return {
      theme: 'light',
      editorFontSize: 14,
      autoSave: true,
      layoutPreferences: {
        channelLayout: 'grid',
        plotPosition: 'right',
        defaultKeywordSide: 'left',
        defaultTimeGutterSide: 'right',
      },
    };
  }

  /**
   * Get an immutable snapshot of the current state
   */
  getSnapshot(): Readonly<AppState> {
    return {
      ...this.state,
      machines: new Map(this.state.machines),
      channels: new Map(this.state.channels),
      activeChannels: [...this.state.activeChannels],
      settings: { ...this.state.settings },
    };
  }

  // ==================== Machine Management ====================

  /**
   * Register a machine profile
   */
  registerMachine(machine: MachineProfile): void {
    this.state.machines.set(machine.id, machine);
  }

  /**
   * Get a machine profile by ID
   */
  getMachine(id: MachineId): MachineProfile | undefined {
    return this.state.machines.get(id);
  }

  /**
   * Get all registered machines
   */
  getAllMachines(): MachineProfile[] {
    return Array.from(this.state.machines.values());
  }

  /**
   * Set the global machine (applies to all channels without specific override)
   */
  setGlobalMachine(machineId: MachineId): void {
    this.state.globalMachineId = machineId;

    // Update all channels that don't have a specific machine override
    for (const [channelId, channel] of this.state.channels) {
      if (!channel.machineId || channel.machineId === this.state.globalMachineId) {
        this.setChannelMachine(channelId, machineId);
      }
    }

    this.eventBus.emit<MachineChangedEvent>({
      type: 'machine:changed',
      timestamp: Date.now(),
      payload: { machineId },
    });
  }

  /**
   * Get the global machine ID
   */
  getGlobalMachine(): MachineId | undefined {
    return this.state.globalMachineId;
  }

  // ==================== Channel Management ====================

  /**
   * Create a new channel
   */
  createChannel(id: ChannelId, machineId?: MachineId): void {
    const effectiveMachineId = machineId || this.state.globalMachineId;
    if (!effectiveMachineId) {
      throw new Error('No machine ID provided and no global machine set');
    }

    const channel: ChannelState = {
      id,
      isActive: false,
      machineId: effectiveMachineId,
      program: '',
      timeline: {
        programLines: [],
        totalTime: 0,
        currentLine: 0,
      },
      syncEvents: [],
      uiConfig: {
        keywordPanelSide: this.state.settings.layoutPreferences.defaultKeywordSide,
        timeGutterSide: this.state.settings.layoutPreferences.defaultTimeGutterSide,
        variableDrawerOpen: false,
        toolOverlayOpen: false,
        activeTab: 'program',
      },
    };

    this.state.channels.set(id, channel);
  }

  /**
   * Get a channel by ID
   */
  getChannel(id: ChannelId): ChannelState | undefined {
    return this.state.channels.get(id);
  }

  /**
   * Get all channels
   */
  getAllChannels(): ChannelState[] {
    return Array.from(this.state.channels.values());
  }

  /**
   * Update a channel's state
   */
  updateChannel(id: ChannelId, updates: Partial<ChannelState>): void {
    const channel = this.state.channels.get(id);
    if (!channel) {
      throw new Error(`Channel not found: ${id}`);
    }

    const updatedChannel = { ...channel, ...updates };
    this.state.channels.set(id, updatedChannel);

    this.eventBus.emit<ChannelStateChangedEvent>({
      type: 'channel:state-changed',
      timestamp: Date.now(),
      payload: { channelId: id, state: updatedChannel },
    });
  }

  /**
   * Set a channel's machine
   */
  setChannelMachine(channelId: ChannelId, machineId: MachineId): void {
    this.updateChannel(channelId, { machineId });

    this.eventBus.emit<MachineChangedEvent>({
      type: 'machine:changed',
      timestamp: Date.now(),
      payload: { channelId, machineId },
    });
  }

  /**
   * Activate a channel
   */
  activateChannel(id: ChannelId): void {
    this.updateChannel(id, { isActive: true });
    if (!this.state.activeChannels.includes(id)) {
      this.state.activeChannels.push(id);
    }
  }

  /**
   * Deactivate a channel
   */
  deactivateChannel(id: ChannelId): void {
    this.updateChannel(id, { isActive: false });
    this.state.activeChannels = this.state.activeChannels.filter((cid) => cid !== id);
  }

  /**
   * Get active channels
   */
  getActiveChannels(): ChannelState[] {
    return this.state.activeChannels
      .map((id) => this.state.channels.get(id))
      .filter((ch): ch is ChannelState => ch !== undefined);
  }

  /**
   * Toggle channel activation
   */
  toggleChannel(id: ChannelId): void {
    const channel = this.getChannel(id);
    if (channel) {
      if (channel.isActive) {
        this.deactivateChannel(id);
      } else {
        this.activateChannel(id);
      }
    }
  }

  // ==================== Settings Management ====================

  /**
   * Update user settings
   */
  updateSettings(updates: Partial<UserSettings>): void {
    this.state.settings = { ...this.state.settings, ...updates };
  }

  /**
   * Get current settings
   */
  getSettings(): Readonly<UserSettings> {
    return { ...this.state.settings };
  }

  /**
   * Reset to default settings
   */
  resetSettings(): void {
    this.state.settings = this.createDefaultSettings();
  }

  // ==================== Utility Methods ====================

  /**
   * Clear all state
   */
  clear(): void {
    this.state = this.createInitialState();
  }

  /**
   * Load state from a snapshot
   */
  loadSnapshot(snapshot: AppState): void {
    this.state = {
      machines: new Map(snapshot.machines),
      channels: new Map(snapshot.channels),
      globalMachineId: snapshot.globalMachineId,
      activeChannels: [...snapshot.activeChannels],
      settings: { ...snapshot.settings },
    };
  }
}
