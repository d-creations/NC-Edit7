export interface AppConfiguration {
  focasDefaultIp: string;
  backendPort: number;
  themeMode: 'vscode' | 'one-dark' | 'light';
}

export interface IConfigService {
  /** Gets the full current configuration object */
  getConfig(): Promise<AppConfiguration>;
  
  /** Gets a specific configuration key */
  get<K extends keyof AppConfiguration>(key: K): Promise<AppConfiguration[K]>;

  /** Let listeners know if config loads or changes asynchronously */
  onConfigChanged(callback: (newConfig: AppConfiguration) => void): void;
}
