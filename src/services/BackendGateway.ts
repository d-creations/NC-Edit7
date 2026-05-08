// BackendGateway for server communication

import type {
  PlotRequest,
  PlotResponse,
  ServerMachineListRequest,
  ServerMachineListResponse,
  FocasListResponse,
  FocasUploadResponse,
  FocasDownloadResponse,
} from '@core/types';

// Simple API Key for basic security
const API_KEY = 'nc-edit7-secret-key';

export interface BackendConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export class BackendGateway {
  private config: BackendConfig;
  private abortControllers = new Map<string, AbortController>();

  constructor(config?: Partial<BackendConfig>) {
    const port = (window as any).backendPort || 8000;
    this.config = {
      baseUrl: `http://127.0.0.1:${port}/cgiserver_import`, // Modified for Extension Backend
      timeout: 30000,
      retries: 3,
      ...config,
    };
  }

  // --- FOCAS API Methods ---
  
  async getFeatures(): Promise<import('@core/types').BackendFeatures> {
    const port = (window as any).backendPort || 8000;
    const response = await fetch(`http://127.0.0.1:${port}/api/features`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  private getFocasUrl(path: string): string {
    const port = (window as any).backendPort || 8000;
    return `http://127.0.0.1:${port}/api/focas/${path}`;
  }

  async focasPing(ip: string): Promise<import('@core/types').FocasPingResponse> {
    const response = await fetch(`${this.getFocasUrl(`ping`)}?ip_address=${ip}`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async focasConnect(ip: string, port: number = 8193): Promise<{status: string, message: string}> {
    const response = await fetch(this.getFocasUrl('connect'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip_address: ip, port, timeout: 10 })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async focasListPrograms(ip: string, pathNo: number, port: number = 8193): Promise<FocasListResponse> {
    const response = await fetch(`${this.getFocasUrl(`programs/${pathNo}`)}?ip_address=${ip}&port=${port}`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async focasUpload(ip: string, pathNo: number, progNum: number, port: number = 8193): Promise<FocasUploadResponse> {
    const response = await fetch(`${this.getFocasUrl(`upload/${pathNo}/${progNum}`)}?ip_address=${ip}&port=${port}`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async focasDownload(ip: string, pathNo: number, programText: string, port: number = 8193): Promise<FocasDownloadResponse> {
    const response = await fetch(`${this.getFocasUrl(`download/${pathNo}`)}?ip_address=${ip}&port=${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_text: programText })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  // --- CGI API Methods ---

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
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(this.config.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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
          // Convert timeout to more descriptive error
          if (requestId) {
            this.abortControllers.delete(requestId);
          }
          throw new Error('Request timeout - server may be offline or unreachable');
        }

        // Check for network errors
        if (
          error instanceof TypeError &&
          (error.message.includes('fetch') || error.message.includes('NetworkError'))
        ) {
          console.warn(`Network error on attempt ${attempt + 1}: Server may be offline`);
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

    // Throw a more descriptive error
    if (lastError instanceof TypeError) {
      throw new Error('Server is offline or unreachable. Please check your connection.');
    }

    throw lastError || new Error('Request failed after multiple retries');
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


