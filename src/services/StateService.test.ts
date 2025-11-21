import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateService } from './StateService';
import { EventBus } from './EventBus';
import type {
  MachineProfile,
  ChannelState,
  MachineChangedEvent,
  ChannelStateChangedEvent,
} from '@core/types';

describe('StateService', () => {
  let stateService: StateService;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    stateService = new StateService(eventBus);
  });

  describe('getSnapshot', () => {
    it('should return an immutable snapshot of current state', () => {
      const snapshot1 = stateService.getSnapshot();
      const snapshot2 = stateService.getSnapshot();

      expect(snapshot1).not.toBe(snapshot2); // Different objects
      expect(snapshot1.machines).not.toBe(snapshot2.machines); // Deep copy
    });

    it('should include default settings', () => {
      const snapshot = stateService.getSnapshot();

      expect(snapshot.settings).toBeDefined();
      expect(snapshot.settings.theme).toBe('light');
      expect(snapshot.settings.editorFontSize).toBe(14);
      expect(snapshot.settings.autoSave).toBe(true);
    });
  });

  describe('Machine Management', () => {
    const testMachine: MachineProfile = {
      id: 'test-machine',
      name: 'Test Machine',
      controlType: 'MILL',
      availableChannels: 2,
      axes: [
        { name: 'X', type: 'LINEAR', minPosition: -500, maxPosition: 500, units: 'MM' },
        { name: 'Y', type: 'LINEAR', minPosition: -500, maxPosition: 500, units: 'MM' },
        { name: 'Z', type: 'LINEAR', minPosition: -300, maxPosition: 0, units: 'MM' },
      ],
      feedLimits: {
        minFeed: 0,
        maxFeed: 10000,
        rapidFeed: 15000,
        units: 'MM_PER_MIN',
      },
      defaultTools: [],
    };

    describe('registerMachine', () => {
      it('should register a machine profile', () => {
        stateService.registerMachine(testMachine);

        const machine = stateService.getMachine('test-machine');
        expect(machine).toEqual(testMachine);
      });
    });

    describe('getMachine', () => {
      it('should return undefined for non-existent machine', () => {
        const machine = stateService.getMachine('nonexistent');
        expect(machine).toBeUndefined();
      });

      it('should return registered machine', () => {
        stateService.registerMachine(testMachine);
        const machine = stateService.getMachine('test-machine');
        expect(machine).toEqual(testMachine);
      });
    });

    describe('getAllMachines', () => {
      it('should return empty array when no machines registered', () => {
        const machines = stateService.getAllMachines();
        expect(machines).toEqual([]);
      });

      it('should return all registered machines', () => {
        const machine1: MachineProfile = { ...testMachine, id: 'machine-1' };
        const machine2: MachineProfile = { ...testMachine, id: 'machine-2' };

        stateService.registerMachine(machine1);
        stateService.registerMachine(machine2);

        const machines = stateService.getAllMachines();
        expect(machines).toHaveLength(2);
        expect(machines).toContainEqual(machine1);
        expect(machines).toContainEqual(machine2);
      });
    });

    describe('setGlobalMachine', () => {
      it('should set global machine and emit event', () => {
        stateService.registerMachine(testMachine);

        const emitSpy = vi.spyOn(eventBus, 'emit');
        stateService.setGlobalMachine('test-machine');

        expect(stateService.getGlobalMachine()).toBe('test-machine');
        expect(emitSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'machine:changed',
            payload: { machineId: 'test-machine' },
          })
        );
      });
    });

    describe('getGlobalMachine', () => {
      it('should return undefined when no global machine is set', () => {
        expect(stateService.getGlobalMachine()).toBeUndefined();
      });

      it('should return global machine ID when set', () => {
        stateService.registerMachine(testMachine);
        stateService.setGlobalMachine('test-machine');
        expect(stateService.getGlobalMachine()).toBe('test-machine');
      });
    });
  });

  describe('Channel Management', () => {
    const testMachine: MachineProfile = {
      id: 'test-machine',
      name: 'Test Machine',
      controlType: 'MILL',
      availableChannels: 2,
      axes: [],
      feedLimits: {
        minFeed: 0,
        maxFeed: 10000,
        rapidFeed: 15000,
        units: 'MM_PER_MIN',
      },
      defaultTools: [],
    };

    beforeEach(() => {
      stateService.registerMachine(testMachine);
      stateService.setGlobalMachine('test-machine');
    });

    describe('createChannel', () => {
      it('should create a channel with global machine if no machine specified', () => {
        stateService.createChannel('channel-1');

        const channel = stateService.getChannel('channel-1');
        expect(channel).toBeDefined();
        expect(channel?.id).toBe('channel-1');
        expect(channel?.machineId).toBe('test-machine');
        expect(channel?.isActive).toBe(false);
      });

      it('should create a channel with specified machine', () => {
        const machine2: MachineProfile = { ...testMachine, id: 'machine-2' };
        stateService.registerMachine(machine2);

        stateService.createChannel('channel-1', 'machine-2');

        const channel = stateService.getChannel('channel-1');
        expect(channel?.machineId).toBe('machine-2');
      });

      it('should throw error if no machine ID and no global machine', () => {
        const newStateService = new StateService(eventBus);

        expect(() => {
          newStateService.createChannel('channel-1');
        }).toThrow('No machine ID provided and no global machine set');
      });

      it('should initialize channel with default UI config', () => {
        stateService.createChannel('channel-1');

        const channel = stateService.getChannel('channel-1');
        expect(channel?.uiConfig).toBeDefined();
        expect(channel?.uiConfig.keywordPanelSide).toBe('left');
        expect(channel?.uiConfig.timeGutterSide).toBe('right');
        expect(channel?.uiConfig.variableDrawerOpen).toBe(false);
      });
    });

    describe('getChannel', () => {
      it('should return undefined for non-existent channel', () => {
        const channel = stateService.getChannel('nonexistent');
        expect(channel).toBeUndefined();
      });

      it('should return created channel', () => {
        stateService.createChannel('channel-1');
        const channel = stateService.getChannel('channel-1');
        expect(channel?.id).toBe('channel-1');
      });
    });

    describe('getAllChannels', () => {
      it('should return empty array when no channels created', () => {
        const channels = stateService.getAllChannels();
        expect(channels).toEqual([]);
      });

      it('should return all created channels', () => {
        stateService.createChannel('channel-1');
        stateService.createChannel('channel-2');

        const channels = stateService.getAllChannels();
        expect(channels).toHaveLength(2);
      });
    });

    describe('updateChannel', () => {
      it('should update channel state and emit event', () => {
        stateService.createChannel('channel-1');

        const emitSpy = vi.spyOn(eventBus, 'emit');

        stateService.updateChannel('channel-1', { program: 'G0 X10' });

        const channel = stateService.getChannel('channel-1');
        expect(channel?.program).toBe('G0 X10');
        expect(emitSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'channel:state-changed',
            payload: expect.objectContaining({
              channelId: 'channel-1',
            }),
          })
        );
      });

      it('should throw error when updating non-existent channel', () => {
        expect(() => {
          stateService.updateChannel('nonexistent', { program: 'test' });
        }).toThrow('Channel not found: nonexistent');
      });
    });

    describe('setChannelMachine', () => {
      it('should set channel machine and emit event', () => {
        const machine2: MachineProfile = { ...testMachine, id: 'machine-2' };
        stateService.registerMachine(machine2);
        stateService.createChannel('channel-1');

        const emitSpy = vi.spyOn(eventBus, 'emit');

        stateService.setChannelMachine('channel-1', 'machine-2');

        const channel = stateService.getChannel('channel-1');
        expect(channel?.machineId).toBe('machine-2');
        expect(emitSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'machine:changed',
            payload: { channelId: 'channel-1', machineId: 'machine-2' },
          })
        );
      });
    });

    describe('activateChannel / deactivateChannel', () => {
      it('should activate a channel', () => {
        stateService.createChannel('channel-1');
        stateService.activateChannel('channel-1');

        const channel = stateService.getChannel('channel-1');
        expect(channel?.isActive).toBe(true);

        const activeChannels = stateService.getActiveChannels();
        expect(activeChannels).toHaveLength(1);
        expect(activeChannels[0]?.id).toBe('channel-1');
      });

      it('should deactivate a channel', () => {
        stateService.createChannel('channel-1');
        stateService.activateChannel('channel-1');
        stateService.deactivateChannel('channel-1');

        const channel = stateService.getChannel('channel-1');
        expect(channel?.isActive).toBe(false);

        const activeChannels = stateService.getActiveChannels();
        expect(activeChannels).toHaveLength(0);
      });

      it('should not add channel twice to active list', () => {
        stateService.createChannel('channel-1');
        stateService.activateChannel('channel-1');
        stateService.activateChannel('channel-1');

        const activeChannels = stateService.getActiveChannels();
        expect(activeChannels).toHaveLength(1);
      });
    });

    describe('toggleChannel', () => {
      it('should activate inactive channel', () => {
        stateService.createChannel('channel-1');
        stateService.toggleChannel('channel-1');

        const channel = stateService.getChannel('channel-1');
        expect(channel?.isActive).toBe(true);
      });

      it('should deactivate active channel', () => {
        stateService.createChannel('channel-1');
        stateService.activateChannel('channel-1');
        stateService.toggleChannel('channel-1');

        const channel = stateService.getChannel('channel-1');
        expect(channel?.isActive).toBe(false);
      });
    });
  });

  describe('Settings Management', () => {
    describe('updateSettings', () => {
      it('should update user settings', () => {
        stateService.updateSettings({ theme: 'dark', editorFontSize: 16 });

        const settings = stateService.getSettings();
        expect(settings.theme).toBe('dark');
        expect(settings.editorFontSize).toBe(16);
        expect(settings.autoSave).toBe(true); // Unchanged
      });
    });

    describe('getSettings', () => {
      it('should return current settings', () => {
        const settings = stateService.getSettings();
        expect(settings).toBeDefined();
        expect(settings.theme).toBe('light');
      });
    });

    describe('resetSettings', () => {
      it('should reset to default settings', () => {
        stateService.updateSettings({ theme: 'dark', editorFontSize: 20 });
        stateService.resetSettings();

        const settings = stateService.getSettings();
        expect(settings.theme).toBe('light');
        expect(settings.editorFontSize).toBe(14);
      });
    });
  });

  describe('Utility Methods', () => {
    describe('clear', () => {
      it('should clear all state', () => {
        const testMachine: MachineProfile = {
          id: 'test-machine',
          name: 'Test',
          controlType: 'MILL',
          availableChannels: 1,
          axes: [],
          feedLimits: {
            minFeed: 0,
            maxFeed: 10000,
            rapidFeed: 15000,
            units: 'MM_PER_MIN',
          },
          defaultTools: [],
        };

        stateService.registerMachine(testMachine);
        stateService.setGlobalMachine('test-machine');
        stateService.createChannel('channel-1');

        stateService.clear();

        expect(stateService.getAllMachines()).toHaveLength(0);
        expect(stateService.getAllChannels()).toHaveLength(0);
        expect(stateService.getGlobalMachine()).toBeUndefined();
      });
    });

    describe('loadSnapshot', () => {
      it('should load state from snapshot', () => {
        const testMachine: MachineProfile = {
          id: 'test-machine',
          name: 'Test',
          controlType: 'MILL',
          availableChannels: 1,
          axes: [],
          feedLimits: {
            minFeed: 0,
            maxFeed: 10000,
            rapidFeed: 15000,
            units: 'MM_PER_MIN',
          },
          defaultTools: [],
        };

        stateService.registerMachine(testMachine);
        stateService.setGlobalMachine('test-machine');
        stateService.createChannel('channel-1');

        const snapshot = stateService.getSnapshot();

        const newStateService = new StateService(eventBus);
        newStateService.loadSnapshot(snapshot);

        expect(newStateService.getAllMachines()).toHaveLength(1);
        expect(newStateService.getAllChannels()).toHaveLength(1);
        expect(newStateService.getGlobalMachine()).toBe('test-machine');
      });
    });
  });
});
