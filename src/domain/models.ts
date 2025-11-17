export type ChannelId = string;

export interface MachineProfile {
  id: string;
  name: string;
  axes: string[];
  channels: ChannelId[];
  defaultTool?: number;
  metadata?: Record<string, string>;
}

export interface ChannelState {
  channelId: ChannelId;
  program: string;
  parseResult?: NcParseResult;
  errors: ParseError[];
  timeline: number[];
  lastUpdated: number;
}

export interface NcLine {
  lineNumber: number;
  rawLine: string;
  strippedLine: string;
  tokens: string[];
}

export interface SyncEvent {
  channelId: ChannelId;
  lineNumber: number;
  keyword: string;
  timingOffset: number;
}

export interface ParseError {
  lineNumber: number;
  message: string;
}

export interface ToolUsage {
  lineNumber: number;
  toolNumber: number;
}

export interface NcParseResult {
  lines: NcLine[];
  syncEvents: SyncEvent[];
  errors: ParseError[];
  toolUsage: ToolUsage[];
  summary: {
    lineCount: number;
    parsedAt: number;
  };
}
