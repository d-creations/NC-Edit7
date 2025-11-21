// MachineService for managing machine profiles

import type { MachineProfile, MachineType } from '@core/types';
import { BackendGateway } from './BackendGateway';
import { EventBus, EVENT_NAMES } from './EventBus';

export class MachineService {
  private machines: MachineProfile[] = [];
  private backend: BackendGateway;
  private eventBus: EventBus;

  constructor(backend: BackendGateway, eventBus: EventBus) {
    this.backend = backend;
    this.eventBus = eventBus;
  }

  async init(): Promise<void> {
    try {
      await this.fetchMachines();
    } catch (error) {
      console.error('Failed to fetch machines:', error);
      // Provide default machines as fallback
      this.machines = this.getDefaultMachines();
      this.eventBus.publish(EVENT_NAMES.ERROR_OCCURRED, {
        message: 'Failed to load machines from server, using defaults',
        error,
      });
    }
  }

  async fetchMachines(): Promise<MachineProfile[]> {
    const response = await this.backend.listMachines();
    this.machines = response.machines.map(this.convertToMachineProfile);
    this.eventBus.publish(EVENT_NAMES.STATE_CHANGED, { machines: this.machines });
    return this.machines;
  }

  getMachines(): MachineProfile[] {
    return this.machines;
  }

  getMachine(machineType: MachineType): MachineProfile | undefined {
    return this.machines.find((m) => m.machineName === machineType);
  }

  private convertToMachineProfile(data: {
    machineName: MachineType;
    controlType: string;
  }): MachineProfile {
    return {
      machineName: data.machineName,
      controlType: data.controlType,
      axes: ['X', 'Y', 'Z'],
      feedLimits: { min: 0, max: 10000 },
      defaultTools: [],
      availableChannels: 3,
    };
  }

  private getDefaultMachines(): MachineProfile[] {
    const machineTypes: MachineType[] = [
      'SB12RG_F',
      'FANUC_T',
      'SR20JII_F',
      'SB12RG_B',
      'SR20JII_B',
      'ISO_MILL',
    ];

    return machineTypes.map((machineType) => ({
      machineName: machineType,
      controlType: 'CNC',
      axes: ['X', 'Y', 'Z'],
      feedLimits: { min: 0, max: 10000 },
      defaultTools: [],
      availableChannels: 3,
    }));
  }
}
