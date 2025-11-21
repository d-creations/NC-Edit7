/**
 * UserPreferenceService - Stores and retrieves user preferences from localStorage
 */

import type { UserSettings, LayoutPreferences } from '@core/types';

const STORAGE_KEY = 'nc-edit7-preferences';

/**
 * UserPreferenceService manages user preferences with localStorage persistence
 */
export class UserPreferenceService {
  private settings: UserSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return this.validateSettings(parsed);
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    }

    return this.getDefaultSettings();
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): UserSettings {
    return {
      theme: 'light',
      editorFontSize: 14,
      autoSave: true,
      layoutPreferences: {
        channelLayout: 'grid',
        plotPosition: 'right',
        defaultKeywordSide: 'left',
        defaultTimeGutterSide: 'right',
      },
    };
  }

  /**
   * Validate and merge loaded settings with defaults
   */
  private validateSettings(settings: Partial<UserSettings>): UserSettings {
    const defaults = this.getDefaultSettings();

    return {
      theme: settings.theme === 'dark' ? 'dark' : 'light',
      editorFontSize:
        typeof settings.editorFontSize === 'number'
          ? settings.editorFontSize
          : defaults.editorFontSize,
      autoSave: typeof settings.autoSave === 'boolean' ? settings.autoSave : defaults.autoSave,
      defaultMachine: settings.defaultMachine,
      layoutPreferences: {
        ...defaults.layoutPreferences,
        ...settings.layoutPreferences,
      },
    };
  }

  /**
   * Get current settings
   */
  getSettings(): Readonly<UserSettings> {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(updates: Partial<UserSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.saveSettings();
  }

  /**
   * Update layout preferences
   */
  updateLayoutPreferences(updates: Partial<LayoutPreferences>): void {
    this.settings.layoutPreferences = {
      ...this.settings.layoutPreferences,
      ...updates,
    };
    this.saveSettings();
  }

  /**
   * Set theme
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.settings.theme = theme;
    this.saveSettings();

    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Set editor font size
   */
  setEditorFontSize(size: number): void {
    this.settings.editorFontSize = Math.max(8, Math.min(32, size));
    this.saveSettings();
  }

  /**
   * Set auto-save preference
   */
  setAutoSave(enabled: boolean): void {
    this.settings.autoSave = enabled;
    this.saveSettings();
  }

  /**
   * Set default machine
   */
  setDefaultMachine(machineId: string): void {
    this.settings.defaultMachine = machineId;
    this.saveSettings();
  }

  /**
   * Clear default machine
   */
  clearDefaultMachine(): void {
    delete this.settings.defaultMachine;
    this.saveSettings();
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings();
  }

  /**
   * Export settings as JSON
   */
  export(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  import(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      this.settings = this.validateSettings(parsed);
      this.saveSettings();
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
}
