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
    if (response.canal && typeof response.canal === 'object') {
      console.log('Canal data received:', response.canal);

      // Parse the canal data - it's keyed by canal number
      const canalData = response.canal as Record<
        string,
        {
          segments?: Array<{
            type?: string;
            lineNumber?: number;
            toolNumber?: number;
            points?: Array<{ x: number; y: number; z: number }>;
          }>;
          executedLines?: number[];
          variables?: Record<string, number>;
          timing?: number[];
        }
      >;

      // Merge data from all canals
      for (const canalNr of Object.keys(canalData)) {
        const canal = canalData[canalNr];

        // Parse executed lines
        if (canal.executedLines && Array.isArray(canal.executedLines)) {
          result.executedLines.push(...canal.executedLines);
        }

        // Parse timing data
        if (canal.timing && Array.isArray(canal.timing)) {
          canal.timing.forEach((time, index) => {
            const lineNumber = canal.executedLines?.[index] || index + 1;
            result.timingData.set(lineNumber, time);
          });
        }

        // Parse variables
        if (canal.variables && typeof canal.variables === 'object') {
          for (const [key, value] of Object.entries(canal.variables)) {
            const varNum = parseInt(key, 10);
            if (!isNaN(varNum)) {
              result.variableSnapshot.set(varNum, value);
            }
          }
        }

        // Parse segments and convert to PlotSegment format
        if (canal.segments && Array.isArray(canal.segments)) {
          canal.segments.forEach((segment) => {
            if (segment.points && segment.points.length >= 2) {
              const startPoint = segment.points[0];
              const endPoint = segment.points[1];

              // Map server segment type to client type
              let segmentType: 'rapid' | 'feed' | 'arc' = 'feed';
              if (segment.type) {
                const serverType = segment.type.toUpperCase();
                if (serverType === 'RAPID' || serverType === 'G0') {
                  segmentType = 'rapid';
                } else if (serverType === 'ARC' || serverType === 'G2' || serverType === 'G3') {
                  segmentType = 'arc';
                }
              }

              // Add segment
              result.plotMetadata!.segments.push({
                startPoint: {
                  x: startPoint.x,
                  y: startPoint.y,
                  z: startPoint.z,
                  lineNumber: segment.lineNumber,
                },
                endPoint: {
                  x: endPoint.x,
                  y: endPoint.y,
                  z: endPoint.z,
                  lineNumber: segment.lineNumber,
                },
                type: segmentType,
                toolNumber: segment.toolNumber,
              });

              // Add points to the points array
              result.plotMetadata!.points.push(
                {
                  x: startPoint.x,
                  y: startPoint.y,
                  z: startPoint.z,
                  lineNumber: segment.lineNumber,
                },
                { x: endPoint.x, y: endPoint.y, z: endPoint.z, lineNumber: segment.lineNumber },
              );
            }
          });
        }
      }
    }

    return result;
  }

  private getCacheKey(request: ExecutionRequest): string {
    // Create a simple hash of the request content
    // Using a basic string hash for cache key generation
    const content = `${request.channelId}-${request.machineName}-${request.program}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${request.channelId}-${request.machineName}-${Math.abs(hash)}`;
  }

  getCachedResult(request: ExecutionRequest): ExecutedProgramResult | undefined {
    const cacheKey = this.getCacheKey(request);
    return this.executionCache.get(cacheKey);
  }

  clearCache(): void {
    this.executionCache.clear();
  }
}
