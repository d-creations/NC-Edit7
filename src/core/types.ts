/**
 * Core type definitions for NC-Edit7
 * Domain models and interfaces for the multi-channel CNC editor
 */

// ==================== Identifiers ====================

export type ChannelId = string;
export type MachineId = string;
export type ToolNumber = number;

// ==================== Machine Profile ====================

export interface MachineProfile {
  id: MachineId;
  name: string;
  controlType: 'MILL' | 'TURN' | 'MULTI_AXIS';
  availableChannels: number; // 1-3
  axes: Axis[];
  feedLimits: FeedLimits;
  defaultTools: ToolInfo[];
  kinematics?: KinematicsConfig;
}

export interface Axis {
  name: string;
  type: 'LINEAR' | 'ROTARY';
  minPosition: number;
  maxPosition: number;
  units: 'MM' | 'INCH' | 'DEGREE';
}

export interface FeedLimits {
  minFeed: number;
  maxFeed: number;
  rapidFeed: number;
  units: 'MM_PER_MIN' | 'INCH_PER_MIN';
}

export interface KinematicsConfig {
  type: 'CARTESIAN' | 'CYLINDRICAL' | 'SCARA';
  parameters: Record<string, number>;
}

// ==================== Channel State ====================

export interface ChannelState {
  id: ChannelId;
  isActive: boolean;
  machineId: MachineId;
  program: string;
  timeline: ChannelTimeline;
  syncEvents: SyncEvent[];
  parseResult?: NcParseResult;
  parseArtifacts?: ParseArtifacts;
  executedResult?: ExecutedProgramResult;
  uiConfig: ChannelUIConfig;
}

export interface ChannelTimeline {
  programLines: TimelineEntry[];
  totalTime: number;
  currentLine: number;
}

export interface TimelineEntry {
  lineNumber: number;
  executionTime: number;
  cumulativeTime: number;
  isSync: boolean;
}

export interface ChannelUIConfig {
  keywordPanelSide: 'left' | 'right';
  timeGutterSide: 'left' | 'right';
  variableDrawerOpen: boolean;
  toolOverlayOpen: boolean;
  activeTab: 'program' | 'executed';
}

// ==================== Tool Information ====================

export interface ToolInfo {
  toolNumber: ToolNumber;
  geometry: ToolGeometry;
  description?: string;
}

export interface ToolGeometry {
  diameter: number;
  length: number;
  cornerRadius?: number;
  tipAngle?: number;
  offsets: ToolOffsets;
}

export interface ToolOffsets {
  x: number;
  y: number;
  z: number;
}

export interface ToolUsage {
  toolNumber: ToolNumber;
  channel: ChannelId;
  lineNumbers: number[];
  totalTime: number;
}

export interface ToolRegisterEntry {
  toolNumber: ToolNumber;
  qParameter?: number; // Q parameter value
  rParameter?: number; // R parameter value
  lineNumber: number;
}

// ==================== Synchronization ====================

export interface SyncEvent {
  lineNumber: number;
  code: string;
  channels: ChannelId[];
  timingOffset: number;
  type: 'WAIT' | 'SIGNAL' | 'BARRIER';
}

// ==================== Parsing Results ====================

export interface NcParseResult {
  faultDetected: boolean;
  faults?: FaultDetail[];
}

export interface FaultDetail {
  lineNumber: number;
  column: number;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  code?: string;
}

export interface ParseArtifacts {
  keywords: KeywordEntry[];
  variableSnapshot: VariableRegister;
  toolRegisters: ToolRegisterEntry[];
  timingMetadata: TimingMetadata;
  syncEvents: SyncEvent[];
}

export interface KeywordEntry {
  keyword: string;
  lineNumber: number;
  context?: string;
}

export interface VariableRegister {
  registers: Map<number, number>; // Register 1-999 -> value
  lastUpdated: number; // timestamp
}

export interface TimingMetadata {
  estimatedCycleTime: number;
  feedRates: FeedRateEntry[];
  rapidMoves: number;
}

export interface FeedRateEntry {
  lineNumber: number;
  feedRate: number;
  distance: number;
  time: number;
}

// ==================== Executed Program Results ====================

export interface ExecutedProgramResult {
  channel: ChannelId;
  executedLines: ExecutedLineInfo[];
  variableDeltas: VariableRegister;
  plotData: PlotResponse;
  timestamp: number;
}

export interface ExecutedLineInfo {
  originalLineNumber: number;
  executedLineNumber: number;
  executionTime: number;
  cumulativeTime: number;
}

// ==================== Plot Data ====================

export interface PlotRequest {
  machineId: MachineId;
  channels: PlotChannelRequest[];
}

export interface PlotChannelRequest {
  channelId: ChannelId;
  program: string;
}

export interface PlotResponse {
  channel: ChannelId;
  segments: PlotSegment[];
  metadata: PlotMetadata;
}

export interface PlotSegment {
  type: 'RAPID' | 'FEED' | 'ARC' | 'DWELL';
  points: PlotPoint[];
  toolNumber: ToolNumber;
  feedRate?: number;
  lineNumber: number;
}

export interface PlotPoint {
  x: number;
  y: number;
  z: number;
  a?: number;
  b?: number;
  c?: number;
}

export interface PlotMetadata {
  bounds: BoundingBox;
  totalDistance: number;
  totalTime: number;
}

export interface BoundingBox {
  min: PlotPoint;
  max: PlotPoint;
}

// ==================== Server DTOs ====================

export interface ServerMachineDataRequest {
  machinedata?: ServerProgramEntry[];
  action?: 'list_machines' | 'get_machines';
}

export interface ServerProgramEntry {
  program: string;
  machineName: string;
  canalNr: string | number;
}

export interface ServerResponse {
  canal?: unknown; // Engine result
  message?: string[];
  message_TEST?: string[];
  machines?: ServerMachineInfo[];
}

export interface ServerMachineInfo {
  machineName: string;
  controlType: string;
}

// ==================== Application State ====================

export interface AppState {
  machines: Map<MachineId, MachineProfile>;
  channels: Map<ChannelId, ChannelState>;
  globalMachineId?: MachineId;
  activeChannels: ChannelId[];
  settings: UserSettings;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  editorFontSize: number;
  autoSave: boolean;
  defaultMachine?: MachineId;
  layoutPreferences: LayoutPreferences;
}

export interface LayoutPreferences {
  channelLayout: 'horizontal' | 'vertical' | 'grid';
  plotPosition: 'right' | 'bottom';
  defaultKeywordSide: 'left' | 'right';
  defaultTimeGutterSide: 'left' | 'right';
}

// ==================== Events ====================

export interface AppEvent {
  type: string;
  timestamp: number;
  payload?: unknown;
}

export interface ChannelStateChangedEvent extends AppEvent {
  type: 'channel:state-changed';
  payload: {
    channelId: ChannelId;
    state: ChannelState;
  };
}

export interface MachineChangedEvent extends AppEvent {
  type: 'machine:changed';
  payload: {
    channelId?: ChannelId;
    machineId: MachineId;
  };
}

export interface ParseCompletedEvent extends AppEvent {
  type: 'parse:completed';
  payload: {
    channelId: ChannelId;
    result: NcParseResult;
    artifacts: ParseArtifacts;
  };
}

export interface ExecutionCompletedEvent extends AppEvent {
  type: 'execution:completed';
  payload: {
    channelId: ChannelId;
    result: ExecutedProgramResult;
  };
}

export interface ErrorEvent extends AppEvent {
  type: 'error';
  payload: {
    message: string;
    source: string;
    details?: unknown;
  };
}

// ==================== Service Tokens ====================

export const SERVICE_TOKENS = {
  EventBus: Symbol('EventBus'),
  StateService: Symbol('StateService'),
  MachineService: Symbol('MachineService'),
  ParserService: Symbol('ParserService'),
  ExecutedProgramService: Symbol('ExecutedProgramService'),
  BackendGateway: Symbol('BackendGateway'),
  PlotService: Symbol('PlotService'),
  UserPreferenceService: Symbol('UserPreferenceService'),
  CommandService: Symbol('CommandService'),
  DiagnosticsService: Symbol('DiagnosticsService'),
} as const;

export type ServiceToken = (typeof SERVICE_TOKENS)[keyof typeof SERVICE_TOKENS];
