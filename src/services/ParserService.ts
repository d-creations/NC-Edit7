// ParserService for client-side NC code parsing

import type {
  NcParseResult,
  ParseArtifacts,
  KeywordEntry,
  ToolRegisterEntry,
  TimingMetadata,
} from '@core/types';
import { EventBus, EVENT_NAMES } from './EventBus';

export class ParserService {
  private eventBus: EventBus;
  private worker?: Worker;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async init(): Promise<void> {
    // In a real implementation, we'd initialize a Web Worker here
    // For now, we'll do basic parsing on the main thread
  }

  async parse(program: string): Promise<{ result: NcParseResult; artifacts: ParseArtifacts }> {
    try {
      // Basic parsing logic - in production this would be in a worker
      const lines = program.split('\n');
      const keywords: KeywordEntry[] = [];
      const toolRegisters: ToolRegisterEntry[] = [];
      const timingMetadata: TimingMetadata[] = [];
      const variableSnapshot = new Map<number, number>();
      const faults: Array<{ lineNumber: number; message: string; severity: 'error' | 'warning' }> =
        [];

      // Simple keyword detection
      const toolPattern = /T(\d+)/i;

      lines.forEach((line, index) => {
        const lineNumber = index + 1;

        // Find keywords - recreate regex for each line to avoid state issues
        const keywordPatterns = /\b(G0|G1|G2|G3|M3|M5|M30|M0|M1)\b/gi;
        let match;
        while ((match = keywordPatterns.exec(line)) !== null) {
          keywords.push({
            keyword: match[0].toUpperCase(),
            lineNumber,
          });
        }

        // Find tool changes
        const toolMatch = line.match(toolPattern);
        if (toolMatch) {
          const toolNumber = parseInt(toolMatch[1]);
          if (!toolRegisters.find((t) => t.toolNumber === toolNumber)) {
            toolRegisters.push({ toolNumber });
          }
        }

        // Basic timing estimate (simplified)
        timingMetadata.push({
          lineNumber,
          executionTime: 0.1, // Placeholder
        });
      });

      const result: NcParseResult = {
        faultDetected: faults.length > 0,
        faults,
      };

      const artifacts: ParseArtifacts = {
        keywords,
        variableSnapshot,
        toolRegisters,
        timingMetadata,
      };

      this.eventBus.publish(EVENT_NAMES.PARSE_COMPLETED, { result, artifacts });

      return { result, artifacts };
    } catch (error) {
      const errorResult: NcParseResult = {
        faultDetected: true,
        faults: [
          {
            lineNumber: 0,
            message: error instanceof Error ? error.message : 'Parse error',
            severity: 'error',
          },
        ],
      };

      this.eventBus.publish(EVENT_NAMES.PARSE_ERROR, { error });

      return {
        result: errorResult,
        artifacts: {
          keywords: [],
          variableSnapshot: new Map(),
          toolRegisters: [],
          timingMetadata: [],
        },
      };
    }
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
    }
  }
}
