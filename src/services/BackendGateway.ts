/**
 * BackendGateway - Handles communication with the CGI server
 */

import type {
  ServerMachineDataRequest,
  ServerResponse,
  ServerMachineInfo,
  ServerProgramEntry,
} from '@core/types';

export interface BackendConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * BackendGateway wraps fetch calls to the plotting server,
 * handles retries, cancellation, and response mapping
 */
export class BackendGateway {
  private config: BackendConfig;
  private abortControllers = new Map<string, AbortController>();

  constructor(config?: Partial<BackendConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || '/ncplot7py/scripts/cgiserver.cgi',
      timeout: config?.timeout || 30000,
      retryAttempts: config?.retryAttempts || 2,
      retryDelay: config?.retryDelay || 1000,
    };
  }

  /**
   * List available machines from the server
   */
  async listMachines(): Promise<ServerMachineInfo[]> {
    const request: ServerMachineDataRequest = {
      action: 'list_machines',
    };

    const response = await this.post<ServerResponse>(request, 'list-machines');

    if (!response.machines) {
      throw new Error('Invalid response: missing machines array');
    }

    return response.machines;
  }

  /**
   * Execute programs and get plot data
   */
  async executePrograms(programs: ServerProgramEntry[]): Promise<ServerResponse> {
    // Validate and preprocess programs
    const validatedPrograms = programs.map((prog) => this.validateProgram(prog));

    const request: ServerMachineDataRequest = {
      machinedata: validatedPrograms,
    };

    return await this.post<ServerResponse>(request, 'execute-programs');
  }

  /**
   * Generic POST request with retry logic
   */
  private async post<T>(
    data: ServerMachineDataRequest,
    requestId: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await this.fetchWithTimeout(data, requestId);
        return response as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on abort or validation errors
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }

        // Wait before retry
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    throw new Error(
      `Request failed after ${this.config.retryAttempts + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    data: ServerMachineDataRequest,
    requestId: string
  ): Promise<unknown> {
    // Cancel any existing request with the same ID
    this.cancel(requestId);

    const abortController = new AbortController();
    this.abortControllers.set(requestId, abortController);

    // Set timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.timeout);

    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Check for server-side errors
      if (result.message_TEST) {
        throw new Error(`Server error: ${result.message_TEST.join(', ')}`);
      }

      return result;
    } finally {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Validate and preprocess a program entry
   */
  private validateProgram(program: ServerProgramEntry): ServerProgramEntry {
    // Remove forbidden characters as per server requirements
    const cleanProgram = program.program
      .replace(/[(){}]/g, '') // Remove parentheses and braces
      .trim();

    // Validate machine name
    const validMachines = [
      'SB12RG_F',
      'FANUC_T',
      'SR20JII_F',
      'SB12RG_B',
      'SR20JII_B',
      'ISO_MILL',
    ];

    if (!validMachines.includes(program.machineName)) {
      throw new Error(
        `Invalid machine name: ${program.machineName}. Must be one of: ${validMachines.join(', ')}`
      );
    }

    return {
      ...program,
      program: cleanProgram,
      canalNr: String(program.canalNr), // Ensure string format
    };
  }

  /**
   * Cancel a pending request
   */
  cancel(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BackendConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<BackendConfig> {
    return { ...this.config };
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
