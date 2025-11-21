/**
 * CloudAgentService - Intelligent delegation to cloud-based processing
 *
 * This service determines when to delegate heavy computational tasks to cloud
 * agents instead of local processing, based on program complexity, size, and
 * available resources.
 */

import type {
  ChannelId,
  NcParseResult,
  ParseArtifacts,
  ExecutedProgramResult,
  ServerProgramEntry,
} from '@core/types';
import type { BackendGateway } from './BackendGateway';
import type { EventBus } from './EventBus';

export interface CloudAgentConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  autoDelegate: boolean;
  thresholds: {
    programSizeBytes: number; // Delegate if program exceeds this size
    lineCount: number; // Delegate if program exceeds this line count
    complexity: number; // Delegate if complexity score exceeds this (0-100)
  };
  capabilities: CloudAgentCapabilities;
  timeout: number;
}

export interface CloudAgentCapabilities {
  parsing: boolean;
  execution: boolean;
  plotting: boolean;
  optimization: boolean;
  simulation: boolean;
}

export interface DelegationDecision {
  shouldDelegate: boolean;
  reason: string;
  capability: keyof CloudAgentCapabilities;
  estimatedLocalTime?: number;
  estimatedCloudTime?: number;
}

export interface CloudParseRequest {
  channelId: ChannelId;
  program: string;
  machineId: string;
}

export interface CloudExecuteRequest {
  programs: ServerProgramEntry[];
}

export interface CloudAgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime: number;
  delegatedTo: 'cloud' | 'local';
}

/**
 * CloudAgentService manages intelligent delegation of tasks to cloud agents
 */
export class CloudAgentService {
  private config: CloudAgentConfig;
  private stats = {
    localTasks: 0,
    cloudTasks: 0,
    failedDelegations: 0,
  };

  constructor(
    private backendGateway: BackendGateway,
    private eventBus: EventBus,
    config?: Partial<CloudAgentConfig>
  ) {
    this.config = {
      enabled: config?.enabled ?? false,
      endpoint: config?.endpoint,
      apiKey: config?.apiKey,
      autoDelegate: config?.autoDelegate ?? true,
      thresholds: {
        programSizeBytes: config?.thresholds?.programSizeBytes ?? 10000, // 10KB
        lineCount: config?.thresholds?.lineCount ?? 500,
        complexity: config?.thresholds?.complexity ?? 70,
        ...config?.thresholds,
      },
      capabilities: {
        parsing: true,
        execution: true,
        plotting: true,
        optimization: false,
        simulation: false,
        ...config?.capabilities,
      },
      timeout: config?.timeout ?? 30000,
    };
  }

  /**
   * Determine if a parsing task should be delegated to cloud
   */
  shouldDelegateParsing(program: string): DelegationDecision {
    if (!this.config.enabled || !this.config.capabilities.parsing) {
      return {
        shouldDelegate: false,
        reason: 'Cloud delegation is disabled',
        capability: 'parsing',
      };
    }

    const metrics = this.analyzeProgram(program);

    if (metrics.sizeBytes > this.config.thresholds.programSizeBytes) {
      return {
        shouldDelegate: true,
        reason: `Program size (${metrics.sizeBytes} bytes) exceeds threshold`,
        capability: 'parsing',
        estimatedLocalTime: metrics.lineCount * 2, // ms
        estimatedCloudTime: Math.min(1000, metrics.lineCount * 0.5),
      };
    }

    if (metrics.lineCount > this.config.thresholds.lineCount) {
      return {
        shouldDelegate: true,
        reason: `Line count (${metrics.lineCount}) exceeds threshold`,
        capability: 'parsing',
        estimatedLocalTime: metrics.lineCount * 2,
        estimatedCloudTime: Math.min(1000, metrics.lineCount * 0.5),
      };
    }

    if (metrics.complexityScore > this.config.thresholds.complexity) {
      return {
        shouldDelegate: true,
        reason: `Complexity score (${metrics.complexityScore}) exceeds threshold`,
        capability: 'parsing',
        estimatedLocalTime: metrics.complexityScore * 10,
        estimatedCloudTime: metrics.complexityScore * 2,
      };
    }

    return {
      shouldDelegate: false,
      reason: 'Program is suitable for local parsing',
      capability: 'parsing',
    };
  }

  /**
   * Determine if execution should be delegated to cloud
   */
  shouldDelegateExecution(programs: ServerProgramEntry[]): DelegationDecision {
    if (!this.config.enabled || !this.config.capabilities.execution) {
      return {
        shouldDelegate: false,
        reason: 'Cloud delegation is disabled',
        capability: 'execution',
      };
    }

    const totalSize = programs.reduce((sum, p) => sum + p.program.length, 0);
    const totalLines = programs.reduce((sum, p) => sum + p.program.split('\n').length, 0);

    if (totalSize > this.config.thresholds.programSizeBytes) {
      return {
        shouldDelegate: true,
        reason: 'Total program size exceeds threshold',
        capability: 'execution',
      };
    }

    if (totalLines > this.config.thresholds.lineCount) {
      return {
        shouldDelegate: true,
        reason: 'Total line count exceeds threshold',
        capability: 'execution',
      };
    }

    // Multi-channel programs are better suited for cloud processing
    if (programs.length > 1) {
      return {
        shouldDelegate: true,
        reason: 'Multi-channel execution benefits from cloud processing',
        capability: 'execution',
      };
    }

    return {
      shouldDelegate: false,
      reason: 'Execution is suitable for backend gateway',
      capability: 'execution',
    };
  }

  /**
   * Determine if plotting should be delegated to cloud
   */
  shouldDelegatePlotting(program: string): DelegationDecision {
    if (!this.config.enabled || !this.config.capabilities.plotting) {
      return {
        shouldDelegate: false,
        reason: 'Cloud delegation is disabled',
        capability: 'plotting',
      };
    }

    const metrics = this.analyzeProgram(program);

    // Large programs with many movements benefit from cloud plotting
    if (metrics.lineCount > 1000 || metrics.sizeBytes > 50000) {
      return {
        shouldDelegate: true,
        reason: 'Large program benefits from cloud plotting',
        capability: 'plotting',
      };
    }

    return {
      shouldDelegate: false,
      reason: 'Plotting is suitable for local processing',
      capability: 'plotting',
    };
  }

  /**
   * Analyze program to determine complexity and characteristics
   */
  private analyzeProgram(program: string): {
    sizeBytes: number;
    lineCount: number;
    complexityScore: number;
  } {
    const sizeBytes = new Blob([program]).size;
    const lines = program.split('\n').filter((line) => line.trim());
    const lineCount = lines.length;

    // Calculate complexity score (0-100)
    let complexityScore = 0;

    // Factor in size
    complexityScore += Math.min(20, (sizeBytes / 1000) * 2);

    // Factor in line count
    complexityScore += Math.min(20, (lineCount / 100) * 2);

    // Factor in G-code complexity
    const complexGCodes = (program.match(/G[234]\b/gi) || []).length; // Arcs and complex moves
    complexityScore += Math.min(20, complexGCodes / 10);

    // Factor in tool changes
    const toolChanges = (program.match(/T\d+/gi) || []).length;
    complexityScore += Math.min(15, toolChanges * 2);

    // Factor in synchronization codes
    const syncCodes = (program.match(/M[12]\d\d/gi) || []).length;
    complexityScore += Math.min(15, syncCodes * 5);

    // Factor in macro/subprogram calls
    const subprogramCalls = (program.match(/M98/gi) || []).length;
    complexityScore += Math.min(10, subprogramCalls * 3);

    return {
      sizeBytes,
      lineCount,
      complexityScore: Math.min(100, Math.round(complexityScore)),
    };
  }

  /**
   * Delegate parsing to cloud agent
   */
  async delegateParsing(
    request: CloudParseRequest
  ): Promise<CloudAgentResponse<{ result: NcParseResult; artifacts: ParseArtifacts }>> {
    const startTime = Date.now();

    try {
      // If cloud endpoint is not configured, fall back to backend gateway
      if (!this.config.endpoint) {
        this.stats.localTasks++;
        return {
          success: false,
          error: 'Cloud endpoint not configured, use local parsing',
          processingTime: Date.now() - startTime,
          delegatedTo: 'local',
        };
      }

      // TODO: Implement actual cloud API call
      // For now, this is a placeholder that would call a cloud parsing service
      // The endpoint needs to be configured and the API contract established

      this.stats.cloudTasks++;

      this.eventBus.emit({
        type: 'cloud:task-delegated',
        timestamp: Date.now(),
        payload: {
          taskType: 'parsing',
          channelId: request.channelId,
        },
      });

      console.warn(
        '[CloudAgentService] Cloud parsing endpoint not implemented yet - falling back to local parsing'
      );

      return {
        success: false,
        error: 'Cloud parsing endpoint not implemented yet - use local parsing',
        processingTime: Date.now() - startTime,
        delegatedTo: 'local',
      };
    } catch (error) {
      this.stats.failedDelegations++;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime,
        delegatedTo: 'cloud',
      };
    }
  }

  /**
   * Delegate execution to cloud agent or backend gateway based on decision
   */
  async delegateExecution(
    request: CloudExecuteRequest
  ): Promise<CloudAgentResponse<Map<ChannelId, ExecutedProgramResult>>> {
    const startTime = Date.now();

    try {
      const decision = this.shouldDelegateExecution(request.programs);

      // Always use backend gateway for actual execution
      // The "cloud" in this case refers to the existing CGI backend
      this.stats.cloudTasks++;

      this.eventBus.emit({
        type: 'cloud:task-delegated',
        timestamp: Date.now(),
        payload: {
          taskType: 'execution',
          decision,
        },
      });

      // Delegate to backend gateway (which is the cloud service)
      await this.backendGateway.executePrograms(request.programs);

      // TODO: Parse the backend response and convert to ExecutedProgramResult map
      // For now, return empty result to indicate incomplete implementation
      console.warn(
        '[CloudAgentService] Cloud execution response parsing not implemented - ExecutedProgramService will handle via BackendGateway'
      );

      return {
        success: false,
        error:
          'Cloud execution response parsing not implemented - use ExecutedProgramService directly',
        processingTime: Date.now() - startTime,
        delegatedTo: 'local',
      };
    } catch (error) {
      this.stats.failedDelegations++;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime,
        delegatedTo: 'cloud',
      };
    }
  }

  /**
   * Get statistics about delegation
   */
  getStats() {
    return {
      ...this.stats,
      totalTasks: this.stats.localTasks + this.stats.cloudTasks,
      delegationRate: this.stats.cloudTasks / (this.stats.localTasks + this.stats.cloudTasks) || 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CloudAgentConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      thresholds: {
        ...this.config.thresholds,
        ...config.thresholds,
      },
      capabilities: {
        ...this.config.capabilities,
        ...config.capabilities,
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<CloudAgentConfig> {
    return { ...this.config };
  }

  /**
   * Enable or disable cloud delegation
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if cloud agent is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled || !this.config.endpoint) {
      return false;
    }

    try {
      // TODO: Implement health check to cloud endpoint
      return false; // For now, return false until endpoint is implemented
    } catch {
      return false;
    }
  }
}
