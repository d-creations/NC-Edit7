/**
 * ParserService - Browser-based NC code parsing service
 */

import type {
  ChannelId,
  NcParseResult,
  ParseArtifacts,
  KeywordEntry,
  ToolRegisterEntry,
  SyncEvent,
  ParseCompletedEvent,
} from '@core/types';
import type { EventBus } from './EventBus';
import type { CloudAgentService } from './CloudAgentService';

/**
 * ParserService runs NC code parsing in the browser (optionally in a worker)
 * and emits parse results with artifacts
 */
export class ParserService {
  private workers = new Map<ChannelId, Worker | null>();
  private useWorker = false; // Set to true when worker implementation is ready
  private cloudAgentService?: CloudAgentService;

  constructor(private eventBus: EventBus, cloudAgentService?: CloudAgentService) {
    this.cloudAgentService = cloudAgentService;
  }

  /**
   * Parse NC program for a channel
   */
  async parse(
    channelId: ChannelId,
    program: string
  ): Promise<{
    result: NcParseResult;
    artifacts: ParseArtifacts;
  }> {
    // Check if we should delegate to cloud agent
    if (this.cloudAgentService) {
      const decision = this.cloudAgentService.shouldDelegateParsing(program);

      if (decision.shouldDelegate) {
        console.log(
          `[ParserService] Delegating parsing to cloud agent: ${decision.reason}`
        );

        // Try cloud delegation
        const cloudResponse = await this.cloudAgentService.delegateParsing({
          channelId,
          program,
          machineId: 'ISO_MILL', // TODO: Get from context
        });

        if (cloudResponse.success && cloudResponse.data) {
          console.log(
            `[ParserService] Cloud parsing completed in ${cloudResponse.processingTime}ms`
          );
          return cloudResponse.data;
        } else {
          console.log(
            `[ParserService] Cloud parsing failed, falling back to local: ${cloudResponse.error}`
          );
          // Fall through to local parsing
        }
      }
    }

    if (this.useWorker) {
      return this.parseInWorker(channelId, program);
    }

    return this.parseSync(channelId, program);
  }

  /**
   * Parse synchronously in main thread
   */
  private async parseSync(
    channelId: ChannelId,
    program: string
  ): Promise<{
    result: NcParseResult;
    artifacts: ParseArtifacts;
  }> {
    // TODO: Implement actual NC parsing logic
    // This is a placeholder that extracts basic information

    const lines = program.split('\n');
    const keywords: KeywordEntry[] = [];
    const toolRegisters: ToolRegisterEntry[] = [];
    const syncEvents: SyncEvent[] = [];
    const faults: NcParseResult['faults'] = [];

    // Simple keyword extraction (placeholder)
    const keywordPatterns = [/\b(G0|G1|G2|G3|G4|G90|G91|M3|M4|M5|M6|M30)\b/gi, /\b(T\d+)\b/gi];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Extract keywords
      keywordPatterns.forEach((pattern) => {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          keywords.push({
            keyword: match[0].toUpperCase(),
            lineNumber,
            context: line.trim(),
          });
        }
      });

      // Extract tool changes (T codes)
      const toolMatch = line.match(/T(\d+)/i);
      if (toolMatch && toolMatch[1]) {
        const toolNumber = parseInt(toolMatch[1], 10);

        // Look for Q and R parameters
        const qMatch = line.match(/Q([\d.-]+)/i);
        const rMatch = line.match(/R([\d.-]+)/i);

        toolRegisters.push({
          toolNumber,
          qParameter: qMatch && qMatch[1] ? parseFloat(qMatch[1]) : undefined,
          rParameter: rMatch && rMatch[1] ? parseFloat(rMatch[1]) : undefined,
          lineNumber,
        });
      }

      // Detect synchronization codes (placeholder)
      if (line.match(/\bM200\b/i)) {
        syncEvents.push({
          lineNumber,
          code: 'M200',
          channels: [channelId],
          timingOffset: 0,
          type: 'WAIT',
        });
      }

      // Basic error detection (empty lines, invalid characters, etc.)
      if (
        line.trim() &&
        !line.match(/^[NGMTXYZIJKFRQPSabcdefghijklmnopqrstuvwxyz0-9\s.;()+-]+$/i)
      ) {
        faults.push({
          lineNumber,
          column: 0,
          severity: 'WARNING',
          message: 'Line contains potentially invalid characters',
        });
      }
    });

    const result: NcParseResult = {
      faultDetected: faults.length > 0,
      faults: faults.length > 0 ? faults : undefined,
    };

    const artifacts: ParseArtifacts = {
      keywords,
      variableSnapshot: {
        registers: new Map(), // TODO: Track variable values during parse
        lastUpdated: Date.now(),
      },
      toolRegisters,
      timingMetadata: {
        estimatedCycleTime: 0, // TODO: Calculate from feed rates and distances
        feedRates: [],
        rapidMoves: 0,
      },
      syncEvents,
    };

    // Emit parse completed event
    this.eventBus.emit<ParseCompletedEvent>({
      type: 'parse:completed',
      timestamp: Date.now(),
      payload: {
        channelId,
        result,
        artifacts,
      },
    });

    return { result, artifacts };
  }

  /**
   * Parse in a web worker (to be implemented)
   */
  private async parseInWorker(
    channelId: ChannelId,
    program: string
  ): Promise<{
    result: NcParseResult;
    artifacts: ParseArtifacts;
  }> {
    // TODO: Implement worker-based parsing
    // For now, fall back to sync parsing
    return this.parseSync(channelId, program);
  }

  /**
   * Cancel parsing for a channel
   */
  cancel(channelId: ChannelId): void {
    const worker = this.workers.get(channelId);
    if (worker) {
      worker.terminate();
      this.workers.delete(channelId);
    }
  }

  /**
   * Cancel all parsing
   */
  cancelAll(): void {
    for (const worker of this.workers.values()) {
      if (worker) {
        worker.terminate();
      }
    }
    this.workers.clear();
  }

  /**
   * Dispose of the service
   */
  dispose(): void {
    this.cancelAll();
  }
}
