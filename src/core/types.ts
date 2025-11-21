// Core type definitions for NC-Edit7

export type ChannelId = '1' | '2' | '3';

export type MachineType =
  | 'SB12RG_F'
  | 'FANUC_T'
  | 'SR20JII_F'
  | 'SB12RG_B'
  | 'SR20JII_B'
  | 'ISO_MILL';

export interface MachineProfile {
  machineName: MachineType;
  controlType: string;
  axes: string[];
  feedLimits: { min: number; max: number };
  defaultTools: ToolInfo[];
  kinematics?: unknown;
  availableChannels: number;
}

export interface ToolInfo {
  toolNumber: number;
  geometry: ToolGeometry;
  usage?: ToolUsage;
}

export interface ToolGeometry {
  diameter: number;
  length: number;
  cornerRadius?: number;
  angle?: number;
}

export interface ToolUsage {
  operationType: string;
  feedRate: number;
  spindleSpeed: number;
}

export interface ToolRegisterEntry {
  toolNumber: number;
  qParameter?: number;
  rParameter?: number;
}

export interface ChannelState {
  id: ChannelId;
  active: boolean;
  program: string;
  machineProfile?: MachineProfile;
  timeline?: ChannelTimeline;
  parseResult?: NcParseResult;
  parseArtifacts?: ParseArtifacts;
  executedResult?: ExecutedProgramResult;
}

export interface ChannelTimeline {
  lines: number[];
  syncMarkers: SyncEvent[];
  timingData: Map<number, number>;
}

export interface SyncEvent {
  lineNumber: number;
  code: string;
  channels: ChannelId[];
  timingOffset?: number;
}

export interface NcParseResult {
  faultDetected: boolean;
  faults?: FaultDetail[];
}

export interface FaultDetail {
  lineNumber: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParseArtifacts {
  keywords: KeywordEntry[];
  variableSnapshot: Map<number, number>;
  toolRegisters: ToolRegisterEntry[];
  timingMetadata: TimingMetadata[];
}

export interface KeywordEntry {
  keyword: string;
  lineNumber: number;
  description?: string;
}

export interface TimingMetadata {
  lineNumber: number;
  executionTime: number;
}

export interface ExecutedProgramResult {
  executedLines: number[];
  variableSnapshot: Map<number, number>;
  timingData: Map<number, number>;
  plotMetadata?: PlotMetadata;
}

export interface PlotMetadata {
  points: PlotPoint[];
  segments: PlotSegment[];
}

export interface PlotPoint {
  x: number;
  y: number;
  z: number;
  lineNumber?: number;
}

export interface PlotSegment {
  startPoint: PlotPoint;
  endPoint: PlotPoint;
  type: 'rapid' | 'feed' | 'arc';
  toolNumber?: number;
}

export interface PlotRequest {
  machinedata: Array<{
    program: string;
    machineName: MachineType;
    canalNr: string | number;
  }>;
}

export interface PlotResponse {
  canal?: unknown;
  message?: string;
  message_TEST?: string;
}

export interface ServerMachineListRequest {
  action: 'list_machines' | 'get_machines';
}

export interface ServerMachineListResponse {
  machines: Array<{
    machineName: MachineType;
    controlType: string;
  }>;
}
