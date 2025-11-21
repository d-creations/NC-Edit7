/**
 * ExecutedProgramService - Manages server-side program execution
 */

import type {
  ChannelId,
  ExecutedProgramResult,
  ExecutionCompletedEvent,
  ServerProgramEntry,
  ServerResponse,
} from '@core/types';
import type { BackendGateway } from './BackendGateway';
import type { EventBus } from './EventBus';
import type { StateService } from './StateService';

/**
 * ExecutedProgramService posts programs to the CGI endpoint and processes results
 */
export class ExecutedProgramService {
  constructor(
    private backendGateway: BackendGateway,
    private stateService: StateService,
    private eventBus: EventBus
  ) {}

  /**
   * Execute a single channel's program
   */
  async executeChannel(channelId: ChannelId): Promise<ExecutedProgramResult> {
    const channel = this.stateService.getChannel(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const machine = this.stateService.getMachine(channel.machineId);
    if (!machine) {
      throw new Error(`Machine not found: ${channel.machineId}`);
    }

    const programs: ServerProgramEntry[] = [
      {
        program: channel.program,
        machineName: machine.id,
        canalNr: channelId,
      },
    ];

    return this.execute(programs, channelId);
  }

  /**
   * Execute multiple channels' programs
   */
  async executeMultipleChannels(channelIds: ChannelId[]): Promise<Map<ChannelId, ExecutedProgramResult>> {
    const programs: ServerProgramEntry[] = [];

    for (const channelId of channelIds) {
      const channel = this.stateService.getChannel(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const machine = this.stateService.getMachine(channel.machineId);
      if (!machine) {
        throw new Error(`Machine not found: ${channel.machineId}`);
      }

      programs.push({
        program: channel.program,
        machineName: machine.id,
        canalNr: channelId,
      });
    }

    const results = new Map<ChannelId, ExecutedProgramResult>();

    try {
      const serverResponse = await this.backendGateway.executePrograms(programs);
      
      // Process response for each channel
      for (const channelId of channelIds) {
        const result = this.processServerResponse(serverResponse, channelId);
        results.set(channelId, result);

        // Emit completion event
        this.eventBus.emit<ExecutionCompletedEvent>({
          type: 'execution:completed',
          timestamp: Date.now(),
          payload: {
            channelId,
            result,
          },
        });

        // Update channel state
        this.stateService.updateChannel(channelId, {
          executedResult: result,
        });
      }
    } catch (error) {
      console.error('Failed to execute programs:', error);
      throw error;
    }

    return results;
  }

  /**
   * Execute with raw program entries
   */
  private async execute(
    programs: ServerProgramEntry[],
    primaryChannelId: ChannelId
  ): Promise<ExecutedProgramResult> {
    try {
      const serverResponse = await this.backendGateway.executePrograms(programs);
      const result = this.processServerResponse(serverResponse, primaryChannelId);

      // Emit completion event
      this.eventBus.emit<ExecutionCompletedEvent>({
        type: 'execution:completed',
        timestamp: Date.now(),
        payload: {
          channelId: primaryChannelId,
          result,
        },
      });

      // Update channel state
      this.stateService.updateChannel(primaryChannelId, {
        executedResult: result,
      });

      return result;
    } catch (error) {
      console.error('Failed to execute program:', error);
      throw error;
    }
  }

  /**
   * Process server response into ExecutedProgramResult
   */
  private processServerResponse(
    serverResponse: ServerResponse,
    channelId: ChannelId
  ): ExecutedProgramResult {
    // TODO: Parse the actual server response structure
    // The server returns { canal: <engine_result>, message: <message_stack> }
    
    // For now, create a placeholder result
    const result: ExecutedProgramResult = {
      channel: channelId,
      executedLines: [],
      variableDeltas: {
        registers: new Map(),
        lastUpdated: Date.now(),
      },
      plotData: {
        channel: channelId,
        segments: [],
        metadata: {
          bounds: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 0, y: 0, z: 0 },
          },
          totalDistance: 0,
          totalTime: 0,
        },
      },
      timestamp: Date.now(),
    };

    // TODO: Parse canal data and extract:
    // - Executed line numbers and timing
    // - Variable register updates
    // - Plot point data

    if (serverResponse.canal) {
      // Parse canal data structure here
      console.log('Canal data received:', serverResponse.canal);
    }

    if (serverResponse.message && serverResponse.message.length > 0) {
      console.log('Server messages:', serverResponse.message);
    }

    return result;
  }

  /**
   * Clear execution results for a channel
   */
  clearResults(channelId: ChannelId): void {
    this.stateService.updateChannel(channelId, {
      executedResult: undefined,
    });
  }

  /**
   * Clear all execution results
   */
  clearAllResults(): void {
    const channels = this.stateService.getAllChannels();
    for (const channel of channels) {
      this.clearResults(channel.id);
    }
  }
}
