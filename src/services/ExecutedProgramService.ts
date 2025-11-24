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
import type { CloudAgentService } from './CloudAgentService';

/**
 * ExecutedProgramService posts programs to the CGI endpoint and processes results
 */
export class ExecutedProgramService {
  private cloudAgentService?: CloudAgentService;

  constructor(
    private backendGateway: BackendGateway,
    private stateService: StateService,
    private eventBus: EventBus,
    cloudAgentService?: CloudAgentService
  ) {
    this.cloudAgentService = cloudAgentService;
  }

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
  async executeMultipleChannels(
    channelIds: ChannelId[]
  ): Promise<Map<ChannelId, ExecutedProgramResult>> {
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
      // Check if we should delegate to cloud agent
      if (this.cloudAgentService) {
        const decision = this.cloudAgentService.shouldDelegateExecution(programs);

        if (decision.shouldDelegate) {
          console.log(`[ExecutedProgramService] Delegating execution to cloud: ${decision.reason}`);

          const cloudResponse = await this.cloudAgentService.delegateExecution({ programs });

          if (cloudResponse.success && cloudResponse.data) {
            console.log(
              `[ExecutedProgramService] Cloud execution completed in ${cloudResponse.processingTime}ms`
            );

            // Get result for the primary channel
            const result = cloudResponse.data.get(primaryChannelId);
            if (result) {
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
            }
          } else {
            console.log(
              `[ExecutedProgramService] Cloud execution failed, using backend gateway: ${cloudResponse.error}`
            );
            // Fall through to backend gateway
          }
        }
      }

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
    // The server returns { canal: <engine_result>, message: <message_stack> }
    
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

    // Log raw canal data for debugging
    console.log('ExecutedProgramService received canal payload:', serverResponse.canal);

    // Parse canal data and extract execution results
    if (serverResponse.canal && typeof serverResponse.canal === 'object') {
      const canalData = (serverResponse.canal as Record<string, any>)[channelId];
      
      if (canalData && typeof canalData === 'object') {
        // Extract executed lines
        if (Array.isArray(canalData.executedLines)) {
          result.executedLines = canalData.executedLines.filter((line: any): line is number => typeof line === 'number');
        }

        // Extract segments for plotting
        if (Array.isArray(canalData.segments)) {
          result.plotData.segments = canalData.segments;
          
          // Calculate bounds from segments
          const bounds = this.calculateBounds(canalData.segments);
          result.plotData.metadata.bounds = bounds;
        }

        // Extract variable updates
        if (canalData.variables && typeof canalData.variables === 'object') {
          Object.entries(canalData.variables).forEach(([key, value]) => {
            const registerNum = parseInt(key, 10);
            if (!isNaN(registerNum) && typeof value === 'number') {
              result.variableDeltas.registers.set(registerNum, value);
            }
          });
        }

        // Extract timing data
        if (Array.isArray(canalData.timing)) {
          const totalTime = canalData.timing
            .filter((t: any): t is number => typeof t === 'number')
            .reduce((sum: number, t: number) => sum + t, 0);
          result.plotData.metadata.totalTime = totalTime;
        }
      }
    }

    // Log server messages
    if (serverResponse.message && serverResponse.message.length > 0) {
      console.log('Server messages:', serverResponse.message);
    }

    return result;
  }

  /**
   * Calculate bounding box from segments
   */
  private calculateBounds(segments: any[]) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const segment of segments) {
      if (segment.points && Array.isArray(segment.points)) {
        for (const point of segment.points) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          minZ = Math.min(minZ, point.z);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
          maxZ = Math.max(maxZ, point.z);
        }
      }
    }

    // Handle empty segments
    if (!isFinite(minX)) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      };
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
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
