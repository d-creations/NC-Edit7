/**
 * MachineService - Retrieves and manages machine profiles
 */

import type { MachineId, MachineProfile, ServerMachineInfo } from '@core/types';
import type { BackendGateway } from './BackendGateway';
import type { EventBus } from './EventBus';

/**
 * MachineService retrieves machine profiles from the CGI server,
 * normalizes data, caches responses, and emits change events
 */
export class MachineService {
  private machines = new Map<MachineId, MachineProfile>();
  private loading = false;
  private lastFetch: number = 0;
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(
    private backendGateway: BackendGateway,
    _eventBus: EventBus
  ) {}

  /**
   * Initialize the service by fetching machines
   */
  async init(): Promise<void> {
    await this.fetchMachines();
  }

  /**
   * Fetch machines from the server
   */
  async fetchMachines(force = false): Promise<MachineProfile[]> {
    const now = Date.now();

    // Use cache if available and not expired
    if (!force && this.machines.size > 0 && now - this.lastFetch < this.cacheDuration) {
      return Array.from(this.machines.values());
    }

    if (this.loading) {
      // Wait for existing fetch to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loading) {
            clearInterval(checkInterval);
            resolve(Array.from(this.machines.values()));
          }
        }, 100);
      });
    }

    this.loading = true;

    try {
      const serverMachines = await this.backendGateway.listMachines();
      this.machines.clear();

      for (const serverMachine of serverMachines) {
        const profile = this.convertToMachineProfile(serverMachine);
        this.machines.set(profile.id, profile);
      }

      this.lastFetch = now;
      return Array.from(this.machines.values());
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get a machine profile by ID
   */
  async getMachine(id: MachineId, fetchIfMissing = true): Promise<MachineProfile | undefined> {
    let machine = this.machines.get(id);

    if (!machine && fetchIfMissing) {
      await this.fetchMachines();
      machine = this.machines.get(id);
    }

    return machine;
  }

  /**
   * Get all cached machines
   */
  getAllMachines(): MachineProfile[] {
    return Array.from(this.machines.values());
  }

  /**
   * Check if machines are loaded
   */
  isLoaded(): boolean {
    return this.machines.size > 0;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.machines.clear();
    this.lastFetch = 0;
  }

  /**
   * Convert server machine info to MachineProfile
   */
  private convertToMachineProfile(serverMachine: ServerMachineInfo): MachineProfile {
    const { machineName, controlType } = serverMachine;

    // Parse control type
    let type: 'MILL' | 'TURN' | 'MULTI_AXIS' = 'MILL';
    if (controlType.includes('TURN') || machineName.includes('_T')) {
      type = 'TURN';
    } else if (
      controlType.includes('MILL') ||
      machineName.includes('_F') ||
      machineName.includes('_B')
    ) {
      type = 'MILL';
    }

    // Determine available channels based on machine name
    let availableChannels = 1;
    if (machineName.includes('SB12RG') || machineName.includes('SR20JII')) {
      availableChannels = 2;
    }

    // Create profile with defaults
    const profile: MachineProfile = {
      id: machineName,
      name: machineName,
      controlType: type,
      availableChannels,
      axes: this.getDefaultAxes(type),
      feedLimits: this.getDefaultFeedLimits(type),
      defaultTools: [],
    };

    return profile;
  }

  /**
   * Get default axes for machine type
   */
  private getDefaultAxes(type: 'MILL' | 'TURN' | 'MULTI_AXIS') {
    if (type === 'TURN') {
      return [
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
        {
          name: 'C',
          type: 'ROTARY' as const,
          minPosition: 0,
          maxPosition: 360,
          units: 'DEGREE' as const,
        },
      ];
    }

    return [
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
    ];
  }

  /**
   * Get default feed limits for machine type
   */
  private getDefaultFeedLimits(type: 'MILL' | 'TURN' | 'MULTI_AXIS') {
    if (type === 'TURN') {
      return {
        minFeed: 1,
        maxFeed: 3000,
        rapidFeed: 15000,
        units: 'MM_PER_MIN' as const,
      };
    }

    return {
      minFeed: 1,
      maxFeed: 5000,
      rapidFeed: 20000,
      units: 'MM_PER_MIN' as const,
    };
  }
}
