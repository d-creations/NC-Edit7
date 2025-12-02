import { EventBus } from "../../core/eventBus.js";
import {
  ChannelId,
  NcLine,
  NcParseResult,
  ParseError,
  SyncEvent,
  ToolUsage,
} from "../../domain/models.js";

export interface ParserEvents extends Record<string, unknown> {
  parseCompleted: { channelId: ChannelId; result: NcParseResult };
  parseFailed: { channelId: ChannelId; error: Error };
}

export class ParserService<Events extends ParserEvents> {
  constructor(private readonly eventBus: EventBus<Events>) {}

  parse(channelId: ChannelId, programText: string): NcParseResult {
    try {
      const lines = programText.replace(/\r\n/g, "\n").split("\n");
      const parsedLines: NcLine[] = [];
      const syncEvents: SyncEvent[] = [];
      const toolUsage: ToolUsage[] = [];
      const errors: ParseError[] = [];

      lines.forEach((rawLine, index) => {
        const cleanedLine = this.stripComments(rawLine);
        const tokens = this.tokenize(cleanedLine);

        if (cleanedLine.length === 0 && rawLine.trim().length > 0) {
          errors.push({
            lineNumber: index + 1,
            message: "Line contains only comments or whitespace",
          });
        }

        parsedLines.push({
          lineNumber: index + 1,
          rawLine,
          strippedLine: cleanedLine,
          tokens,
        });

        tokens.forEach((token) => {
          if (token.startsWith("M") || token.startsWith("T")) {
            syncEvents.push({
              channelId,
              lineNumber: index + 1,
              keyword: token,
              timingOffset: index,
            });
          }

          if (token.startsWith("T")) {
            const number = Number(token.substring(1));
            if (!Number.isNaN(number)) {
              toolUsage.push({
                lineNumber: index + 1,
                toolNumber: number,
              });
            }
          }
        });
      });

      const result: NcParseResult = {
        lines: parsedLines,
        syncEvents,
        errors,
        toolUsage,
        summary: {
          lineCount: parsedLines.length,
          parsedAt: Date.now(),
        },
      };

      this.eventBus.emit("parseCompleted", { channelId, result });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown parse error");
      this.eventBus.emit("parseFailed", { channelId, error: err });
      throw err;
    }
  }

  private stripComments(line: string): string {
    return line.replace(/\(.*?\)/g, "").trim();
  }

  private tokenize(line: string): string[] {
    return line
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  }
}
