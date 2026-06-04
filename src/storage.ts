import fs from 'node:fs';
import path from 'node:path';

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

export class Storage {
  private filePath: string;
  private data: Settings;

  constructor(storageDirectory: string) {
    this.filePath = path.join(storageDirectory, 'settings.json');
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
}
