// ExecutedProgramService for server-side program execution

import type {
  ChannelId,
  MachineType,
  ExecutedProgramResult,
  PlotRequest,
  PlotResponse,
} from '@core/types';
import { BackendGateway } from './BackendGateway';
import { EventBus, EVENT_NAMES } from './EventBus';

export interface ExecutionRequest {
  channelId: ChannelId;
  program: string;
  machineName: MachineType;
}

export class ExecutedProgramService {
  private backend: BackendGateway;
  private eventBus: EventBus;
  private executionCache = new Map<string, ExecutedProgramResult>();

  constructor(backend: BackendGateway, eventBus: EventBus) {
    this.backend = backend;
    this.eventBus = eventBus;
  }

  async executeProgram(request: ExecutionRequest): Promise<ExecutedProgramResult> {
    try {
      // Preprocess program: remove () {} characters as per server requirements
      const cleanProgram = this.preprocessProgram(request.program);

      // Build plot request
      const plotRequest: PlotRequest = {
        machinedata: [
          {
            program: cleanProgram,
            machineName: request.machineName,
            canalNr: request.channelId,
          },
        ],
      };

      // Make server request
      const response: PlotResponse = await this.backend.requestPlot(plotRequest);

      // Parse response
      const result = this.parseExecutionResponse(response);

      // Cache result
      const cacheKey = this.getCacheKey(request);
      this.executionCache.set(cacheKey, result);

      // Publish event
      this.eventBus.publish(EVENT_NAMES.EXECUTION_COMPLETED, {
        channelId: request.channelId,
        result,
      });

      return result;
    } catch (error) {
      console.error('Execution failed:', error);
      this.eventBus.publish(EVENT_NAMES.EXECUTION_ERROR, {
        channelId: request.channelId,
        error,
      });
      throw error;
    }
  }

  async executeMultipleChannels(requests: ExecutionRequest[]): Promise<ExecutedProgramResult[]> {
    try {
      // Preprocess all programs
      const machinedata = requests.map((req) => ({
        program: this.preprocessProgram(req.program),
        machineName: req.machineName,
        canalNr: req.channelId,
      }));

      // Build plot request
      const plotRequest: PlotRequest = { machinedata };

      // Make server request
      const response: PlotResponse = await this.backend.requestPlot(plotRequest);

      // Parse response for each channel
      const results = requests.map(() => {
        return this.parseExecutionResponse(response);
      });

      // Publish events
      requests.forEach((req, index) => {
        this.eventBus.publish(EVENT_NAMES.EXECUTION_COMPLETED, {
          channelId: req.channelId,
          result: results[index],
        });
      });

      return results;
    } catch (error) {
      console.error('Multi-channel execution failed:', error);
      requests.forEach((req) => {
        this.eventBus.publish(EVENT_NAMES.EXECUTION_ERROR, {
          channelId: req.channelId,
          error,
        });
      });
      throw error;
    }
  }

  private preprocessProgram(program: string): string {
    // Remove forbidden characters: () {} as per server requirements
    const cleaned = program.replace(/[(){}]/g, '');

    // Server converts newlines to semicolons and removes spaces
    // We'll leave the newlines as is since the server handles this
    return cleaned;
  }

  private parseExecutionResponse(response: PlotResponse): ExecutedProgramResult {
    // TODO: Parse the actual response structure from the server
    // For now, return a stub structure
    const result: ExecutedProgramResult = {
      executedLines: [],
      variableSnapshot: new Map(),
      timingData: new Map(),
      plotMetadata: {
        points: [],
        segments: [],
      },
    };

    // Check for errors in response
    if (response.message_TEST) {
      throw new Error(`Server error: ${response.message_TEST}`);
    }

    // Parse canal data if available
    if (response.canal) {
      // TODO: Parse actual canal structure
      // This will depend on the actual response format
      console.log('Canal data received:', response.canal);
    }

    return result;
  }

  private getCacheKey(request: ExecutionRequest): string {
    // Create a simple hash of the request
    return `${request.channelId}-${request.machineName}-${request.program.length}`;
  }

  getCachedResult(request: ExecutionRequest): ExecutedProgramResult | undefined {
    const cacheKey = this.getCacheKey(request);
    return this.executionCache.get(cacheKey);
  }

  clearCache(): void {
    this.executionCache.clear();
  }
}
