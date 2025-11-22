// StateService for central application state management

import type { ChannelId, ChannelState, MachineProfile, MachineType } from '@core/types';
import { EventBus, EVENT_NAMES } from './EventBus';

export interface AppState {
  machines: MachineProfile[];
  channels: Map<ChannelId, ChannelState>;
  activeMachine?: MachineProfile;
  globalMachine?: MachineType;
  uiSettings: UISettings;
}

export interface UISettings {
  timeGutterPosition: 'left' | 'right';
  keywordListPosition: 'left' | 'right';
  variableDrawerOpen: boolean;
  toolOverlayOpen: boolean;
  plotViewerOpen: boolean;
  plotViewerWidth: number;
}

export class StateService {
  private state: AppState;
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.state = this.getInitialState();
  }

  private getInitialState(): AppState {
    return {
      machines: [],
      channels: new Map([
        ['1', this.createChannelState('1')],
        ['2', this.createChannelState('2')],
        ['3', this.createChannelState('3')],
      ]),
      uiSettings: {
        timeGutterPosition: 'left',
        keywordListPosition: 'left',
        variableDrawerOpen: false,
        toolOverlayOpen: false,
        plotViewerOpen: false,
        plotViewerWidth: 400,
      },
    };
  }

  private createChannelState(id: ChannelId): ChannelState {
    return {
      id,
      active: id === '1', // First channel active by default
      program: '',
    };
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  getChannel(id: ChannelId): ChannelState | undefined {
    return this.state.channels.get(id);
  }

  updateChannel(id: ChannelId, updates: Partial<ChannelState>): void {
    const channel = this.state.channels.get(id);
    if (!channel) return;

    const updatedChannel = { ...channel, ...updates };
    this.state.channels.set(id, updatedChannel);
    this.eventBus.publish(EVENT_NAMES.STATE_CHANGED, { channel: updatedChannel });
  }

  activateChannel(id: ChannelId): void {
    const channel = this.state.channels.get(id);
    if (!channel || channel.active) return;

    this.updateChannel(id, { active: true });
    this.eventBus.publish(EVENT_NAMES.CHANNEL_ACTIVATED, { channelId: id });
  }

  deactivateChannel(id: ChannelId): void {
    const channel = this.state.channels.get(id);
    if (!channel || !channel.active) return;

    this.updateChannel(id, { active: false });
    this.eventBus.publish(EVENT_NAMES.CHANNEL_DEACTIVATED, { channelId: id });
  }

  setMachines(machines: MachineProfile[]): void {
    this.state.machines = machines;
    this.eventBus.publish(EVENT_NAMES.STATE_CHANGED, { machines });
  }

  setGlobalMachine(machineType: MachineType): void {
    this.state.globalMachine = machineType;
    const machine = this.state.machines.find((m) => m.machineName === machineType);
    if (machine) {
      this.state.activeMachine = machine;
      this.eventBus.publish(EVENT_NAMES.MACHINE_CHANGED, { machine });
    }
  }

  updateUISettings(settings: Partial<UISettings>): void {
    this.state.uiSettings = { ...this.state.uiSettings, ...settings };
    this.eventBus.publish(EVENT_NAMES.STATE_CHANGED, { uiSettings: this.state.uiSettings });
  }

  getActiveChannels(): ChannelState[] {
    return Array.from(this.state.channels.values()).filter((ch) => ch.active);
  }
}
