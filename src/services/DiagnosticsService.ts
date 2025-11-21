/**
 * DiagnosticsService - Aggregates and manages errors and diagnostics
 */

import type {
  ChannelId,
  FaultDetail,
  ErrorEvent,
} from '@core/types';
import type { EventBus } from './EventBus';

export interface Diagnostic {
  id: string;
  channelId?: ChannelId;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  source: 'PARSER' | 'BACKEND' | 'SYSTEM';
  message: string;
  details?: unknown;
  timestamp: number;
}

/**
 * DiagnosticsService aggregates parser errors, backend errors,
 * and surfaces guidelines for the UI
 */
export class DiagnosticsService {
  private diagnostics = new Map<string, Diagnostic>();
  private nextId = 1;

  constructor(private eventBus: EventBus) {
    // Subscribe to error events
    this.eventBus.on<ErrorEvent>('error', (event) => {
      this.addDiagnostic({
        channelId: undefined,
        severity: 'ERROR',
        source: 'SYSTEM',
        message: event.payload.message,
        details: event.payload.details,
      });
    });
  }

  /**
   * Add a diagnostic entry
   */
  addDiagnostic(diagnostic: Omit<Diagnostic, 'id' | 'timestamp'>): string {
    const id = `diag-${this.nextId++}`;
    const entry: Diagnostic = {
      ...diagnostic,
      id,
      timestamp: Date.now(),
    };

    this.diagnostics.set(id, entry);
    return id;
  }

  /**
   * Add parser faults as diagnostics
   */
  addParserFaults(channelId: ChannelId, faults: FaultDetail[]): void {
    for (const fault of faults) {
      this.addDiagnostic({
        channelId,
        severity: fault.severity,
        source: 'PARSER',
        message: `Line ${fault.lineNumber}: ${fault.message}`,
        details: fault,
      });
    }
  }

  /**
   * Add a backend error
   */
  addBackendError(message: string, details?: unknown, channelId?: ChannelId): void {
    this.addDiagnostic({
      channelId,
      severity: 'ERROR',
      source: 'BACKEND',
      message,
      details,
    });
  }

  /**
   * Remove a diagnostic by ID
   */
  removeDiagnostic(id: string): boolean {
    return this.diagnostics.delete(id);
  }

  /**
   * Clear diagnostics for a channel
   */
  clearChannel(channelId: ChannelId): void {
    const idsToDelete: string[] = [];
    
    for (const [id, diag] of this.diagnostics) {
      if (diag.channelId === channelId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.diagnostics.delete(id);
    }
  }

  /**
   * Clear all diagnostics
   */
  clearAll(): void {
    this.diagnostics.clear();
  }

  /**
   * Get all diagnostics
   */
  getAllDiagnostics(): Diagnostic[] {
    return Array.from(this.diagnostics.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  /**
   * Get diagnostics for a specific channel
   */
  getChannelDiagnostics(channelId: ChannelId): Diagnostic[] {
    return this.getAllDiagnostics().filter((d) => d.channelId === channelId);
  }

  /**
   * Get diagnostics by severity
   */
  getDiagnosticsBySeverity(severity: 'ERROR' | 'WARNING' | 'INFO'): Diagnostic[] {
    return this.getAllDiagnostics().filter((d) => d.severity === severity);
  }

  /**
   * Get diagnostics by source
   */
  getDiagnosticsBySource(source: 'PARSER' | 'BACKEND' | 'SYSTEM'): Diagnostic[] {
    return this.getAllDiagnostics().filter((d) => d.source === source);
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.getDiagnosticsBySeverity('ERROR').length;
  }

  /**
   * Get warning count
   */
  getWarningCount(): number {
    return this.getDiagnosticsBySeverity('WARNING').length;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.getErrorCount() > 0;
  }

  /**
   * Check if there are any warnings
   */
  hasWarnings(): boolean {
    return this.getWarningCount() > 0;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      total: this.diagnostics.size,
      errors: this.getErrorCount(),
      warnings: this.getWarningCount(),
      info: this.getDiagnosticsBySeverity('INFO').length,
      bySource: {
        parser: this.getDiagnosticsBySource('PARSER').length,
        backend: this.getDiagnosticsBySource('BACKEND').length,
        system: this.getDiagnosticsBySource('SYSTEM').length,
      },
    };
  }
}
