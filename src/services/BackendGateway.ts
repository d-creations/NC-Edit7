// BackendGateway for server communication

import type {
  PlotRequest,
  PlotResponse,
  ServerMachineListRequest,
  ServerMachineListResponse,
} from '@core/types';

export interface BackendConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export class BackendGateway {
  private config: BackendConfig;
  private abortControllers = new Map<string, AbortController>();

  constructor(config?: Partial<BackendConfig>) {
    this.config = {
      baseUrl: '/ncplot7py/scripts/cgiserver.cgi',
      timeout: 30000,
      retries: 3,
      ...config,
    };
  }

  async listMachines(): Promise<ServerMachineListResponse> {
    const request: ServerMachineListRequest = {
      action: 'list_machines',
    };

    return this.post<ServerMachineListResponse>(request);
  }

  async requestPlot(plotRequest: PlotRequest): Promise<PlotResponse> {
    return this.post<PlotResponse>(plotRequest);
  }

  async post<T>(data: unknown, requestId?: string): Promise<T> {
    const controller = new AbortController();
    if (requestId) {
      this.abortControllers.set(requestId, controller);
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        const response = await fetch(this.config.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (requestId) {
          this.abortControllers.delete(requestId);
        }

        return result as T;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }

        // Wait before retry using bit shifting for efficiency
        if (attempt < this.config.retries - 1) {
          await this.sleep((1 << attempt) * 1000);
        }
      }
    }

    if (requestId) {
      this.abortControllers.delete(requestId);
    }

    throw lastError || new Error('Request failed');
  }

  cancel(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  cancelAll(): void {
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
