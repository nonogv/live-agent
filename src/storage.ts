import fs from 'node:fs';
import path from 'node:path';
import type { ProviderMessage } from './providers/index.js';

interface Settings {
  apiKeys: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
  lastProvider?: string;
  lastModel?: string;
}

/** Legacy fields present only in older persisted settings.json files. */
interface LegacySettings extends Partial<Settings> {
  defaultProvider?: string;
  defaultModel?: string;
}

const DEFAULT_SETTINGS: Settings = {
  apiKeys: {},
};

const HISTORY_MAX_MESSAGES = 100;

export class Storage {
  private filePath: string;
  private historyFilePath: string;
  private data: Settings;

  constructor(storageDirectory: string) {
    this.filePath = path.join(storageDirectory, 'settings.json');
    this.historyFilePath = path.join(storageDirectory, 'history.json');
    const { data, migrated } = this.load();
    this.data = data;
    if (migrated) {
      this.save();
    }
  }

  private load(): { data: Settings; migrated: boolean } {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Settings;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as LegacySettings;
      const data: Settings = {
        ...defaults,
        apiKeys: { ...defaults.apiKeys, ...parsed.apiKeys },
        lastProvider: parsed.lastProvider,
        lastModel: parsed.lastModel,
      };

      let migrated = false;
      if (data.lastProvider === undefined && parsed.defaultProvider !== undefined) {
        data.lastProvider = parsed.defaultProvider;
        migrated = true;
      }
      if (data.lastModel === undefined && parsed.defaultModel !== undefined) {
        data.lastModel = parsed.defaultModel;
        migrated = true;
      }
      if (parsed.defaultProvider !== undefined || parsed.defaultModel !== undefined) {
        migrated = true;
      }

      return { data, migrated };
    } catch {
      return { data: defaults, migrated: false };
    }
  }

  private save(): void {
    try {
      const toPersist: Settings = { apiKeys: this.data.apiKeys };
      if (this.data.lastProvider !== undefined) {
        toPersist.lastProvider = this.data.lastProvider;
      }
      if (this.data.lastModel !== undefined) {
        toPersist.lastModel = this.data.lastModel;
      }
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(toPersist, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save settings:', err);
      throw err;
    }
  }

  getApiKey(provider: string): string | undefined {
    return this.data.apiKeys[provider as keyof Settings['apiKeys']];
  }

  setApiKey(provider: string, key: string): void {
    this.data.apiKeys[provider as keyof Settings['apiKeys']] = key;
    this.save();
  }

  /** Returns the last-used provider, defaulting to gemini when unset. */
  getLastProvider(): string {
    return this.data.lastProvider ?? 'gemini';
  }

  /** Returns the last-used model, or an empty string when unset. */
  getLastModel(): string {
    return this.data.lastModel ?? '';
  }

  /** Persists the user's active provider and model selection. */
  saveLastChoice(provider: string, model: string): void {
    this.data.lastProvider = provider;
    this.data.lastModel = model;
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
