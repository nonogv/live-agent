import fs from 'node:fs';
import path from 'node:path';
import type { ProviderMessage } from './providers/index.js';

interface Settings {
  apiKeys: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
  defaultProvider: string;
  defaultModel: string;
}

const DEFAULT_SETTINGS: Settings = {
  apiKeys: {},
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o-mini',
};

const HISTORY_MAX_MESSAGES = 100;

export class Storage {
  private filePath: string;
  private historyFilePath: string;
  private data: Settings;

  constructor(storageDirectory: string) {
    this.filePath = path.join(storageDirectory, 'settings.json');
    this.historyFilePath = path.join(storageDirectory, 'history.json');
    this.data = this.load();
  }

  private load(): Settings {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Settings;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...defaults, ...parsed, apiKeys: { ...defaults.apiKeys, ...parsed.apiKeys } };
    } catch {
      return defaults;
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save settings:', err);
    }
  }

  getApiKey(provider: string): string | undefined {
    return this.data.apiKeys[provider as keyof Settings['apiKeys']];
  }

  setApiKey(provider: string, key: string): void {
    this.data.apiKeys[provider as keyof Settings['apiKeys']] = key;
    this.save();
  }

  getDefaultProvider(): string {
    return this.data.defaultProvider;
  }

  getDefaultModel(): string {
    return this.data.defaultModel;
  }

  setDefaults(provider: string, model: string): void {
    this.data.defaultProvider = provider;
    this.data.defaultModel = model;
    this.save();
  }

  /** Returns masked versions of set keys for display in the UI */
  getMaskedKeys(): Record<string, string> {
    return {
      openai: this.data.apiKeys.openai ? '••••••••' : '',
      anthropic: this.data.apiKeys.anthropic ? '••••••••' : '',
      gemini: this.data.apiKeys.gemini ? '••••••••' : '',
    };
  }

  /**
   * Persists the conversation history to disk, capping at 100 messages.
   * If the array exceeds the cap, the oldest messages are trimmed first.
   */
  saveHistory(messages: ProviderMessage[]): void {
    try {
      const capped =
        messages.length > HISTORY_MAX_MESSAGES
          ? messages.slice(messages.length - HISTORY_MAX_MESSAGES)
          : messages;
      fs.mkdirSync(path.dirname(this.historyFilePath), { recursive: true });
      fs.writeFileSync(this.historyFilePath, JSON.stringify(capped, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save history:', err);
    }
  }

  /**
   * Loads the conversation history from disk.
   * Returns an empty array if the file is missing or contains invalid JSON.
   */
  loadHistory(): ProviderMessage[] {
    try {
      const raw = fs.readFileSync(this.historyFilePath, 'utf-8');
      return JSON.parse(raw) as ProviderMessage[];
    } catch {
      return [];
    }
  }

  /**
   * Deletes the history file, effectively resetting the persisted conversation.
   */
  clearHistory(): void {
    try {
      fs.rmSync(this.historyFilePath, { force: true });
    } catch (err) {
      console.error('[Live Agent] Failed to clear history:', err);
    }
  }
}
