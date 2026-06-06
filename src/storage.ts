import fs from 'node:fs';
import path from 'node:path';
import type { ProviderMessage } from './providers/index.js';
import type { PromptContext } from './agent/chat.js';

/** Persisted metadata for the active Ableton Live set. */
export interface ProjectInfo {
  name: string;
  slug: string;
}

/** Lightweight project fingerprint used for stale-detection. */
export interface ProjectSnapshot {
  trackCount: number;
  trackNames: string[];
  tempo: number;
}

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

/**
 * Converts a project display name to a filesystem-safe slug.
 * Non-alphanumeric characters become hyphens; result is lower-cased.
 */
export function projectNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Persists API keys, provider choice, and per-project agent context on disk. */
export class Storage {
  private readonly storageDirectory: string;
  private filePath: string;
  private data: Settings;

  constructor(storageDirectory: string) {
    this.storageDirectory = storageDirectory;
    this.filePath = path.join(storageDirectory, 'settings.json');
    const { data, migrated } = this.load();
    this.data = data;
    if (migrated) {
      this.save();
    }
    this.migrateLegacyHistory();
  }

  private currentProjectFilePath(): string {
    return path.join(this.storageDirectory, 'current-project.json');
  }

  private globalInstructionsPath(): string {
    return path.join(this.storageDirectory, 'global', 'instructions.md');
  }

  private globalMemoriesPath(): string {
    return path.join(this.storageDirectory, 'global', 'memories.md');
  }

  private projectDir(slug: string): string {
    return path.join(this.storageDirectory, 'projects', slug);
  }

  private projectInstructionsPath(slug: string): string {
    return path.join(this.projectDir(slug), 'instructions.md');
  }

  private projectMemoriesPath(slug: string): string {
    return path.join(this.projectDir(slug), 'memories.md');
  }

  private historyFilePath(slug?: string): string {
    const resolvedSlug = this.resolveHistorySlug(slug);
    return path.join(this.projectDir(resolvedSlug), 'history.json');
  }

  private projectSnapshotPath(slug: string): string {
    return path.join(this.projectDir(slug), 'snapshot.json');
  }

  private resolveProjectSlug(): string {
    return this.loadCurrentProject()?.slug ?? 'default';
  }

  private resolveHistorySlug(slug?: string): string {
    if (slug !== undefined) {
      return slug;
    }
    return this.resolveProjectSlug();
  }

  private readTextFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  private writeTextFile(filePath: string, content: string): void {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to write file:', filePath, err);
      throw err;
    }
  }

  private migrateLegacyHistory(): void {
    const legacyPath = path.join(this.storageDirectory, 'history.json');
    const defaultPath = this.historyFilePath('default');
    try {
      if (fs.existsSync(legacyPath) && !fs.existsSync(defaultPath)) {
        fs.mkdirSync(path.dirname(defaultPath), { recursive: true });
        fs.copyFileSync(legacyPath, defaultPath);
      }
    } catch (err) {
      console.error('[Live Agent] Failed to migrate legacy history:', err);
      throw err;
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
   * Loads the currently active project, if one has been saved.
   * Returns null when no project is set.
   */
  loadCurrentProject(): ProjectInfo | null {
    try {
      const raw = fs.readFileSync(this.currentProjectFilePath(), 'utf-8');
      return JSON.parse(raw) as ProjectInfo;
    } catch {
      return null;
    }
  }

  /**
   * Persists the active project name and slug.
   * When `slug` is omitted it is derived from `name` via {@link projectNameToSlug}.
   * Pass an explicit `slug` (e.g. a fingerprint) to bypass name-based derivation.
   * @returns The saved project metadata.
   */
  saveCurrentProject(name: string, slug?: string): ProjectInfo {
    const project: ProjectInfo = {
      name,
      slug: slug ?? projectNameToSlug(name),
    };
    try {
      fs.mkdirSync(path.dirname(this.currentProjectFilePath()), { recursive: true });
      fs.writeFileSync(this.currentProjectFilePath(), JSON.stringify(project, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save current project:', err);
      throw err;
    }
    return project;
  }

  /** Clears the active project selection. */
  clearCurrentProject(): void {
    try {
      fs.rmSync(this.currentProjectFilePath(), { force: true });
    } catch (err) {
      console.error('[Live Agent] Failed to clear current project:', err);
      throw err;
    }
  }

  /**
   * Persists the conversation history to disk, capping at 100 messages.
   * If the array exceeds the cap, the oldest messages are trimmed first.
   * When no slug is given, uses the current project slug or `"default"`.
   */
  saveHistory(messages: ProviderMessage[], slug?: string): void {
    try {
      const capped =
        messages.length > HISTORY_MAX_MESSAGES
          ? messages.slice(messages.length - HISTORY_MAX_MESSAGES)
          : messages;
      const historyPath = this.historyFilePath(slug);
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, JSON.stringify(capped, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save history:', err);
    }
  }

  /**
   * Loads the conversation history from disk.
   * Returns an empty array if the file is missing or contains invalid JSON.
   * When no slug is given, uses the current project slug or `"default"`.
   */
  loadHistory(slug?: string): ProviderMessage[] {
    try {
      const raw = fs.readFileSync(this.historyFilePath(slug), 'utf-8');
      return JSON.parse(raw) as ProviderMessage[];
    } catch {
      return [];
    }
  }

  /**
   * Deletes the history file, effectively resetting the persisted conversation.
   * When no slug is given, uses the current project slug or `"default"`.
   */
  clearHistory(slug?: string): void {
    try {
      fs.rmSync(this.historyFilePath(slug), { force: true });
    } catch (err) {
      console.error('[Live Agent] Failed to clear history:', err);
    }
  }

  /**
   * Loads instructions for the given scope.
   * Project scope uses the current project slug, falling back to `"default"`.
   */
  loadInstructions(scope: 'global' | 'project'): string {
    if (scope === 'global') {
      return this.readTextFile(this.globalInstructionsPath());
    }
    return this.readTextFile(this.projectInstructionsPath(this.resolveProjectSlug()));
  }

  /**
   * Persists instructions for the given scope.
   * Project scope uses the current project slug, falling back to `"default"`.
   */
  saveInstructions(scope: 'global' | 'project', content: string): void {
    if (scope === 'global') {
      this.writeTextFile(this.globalInstructionsPath(), content);
      return;
    }
    this.writeTextFile(this.projectInstructionsPath(this.resolveProjectSlug()), content);
  }

  /**
   * Loads memories for the given scope.
   * Project scope uses the current project slug, falling back to `"default"`.
   */
  loadMemories(scope: 'global' | 'project'): string {
    if (scope === 'global') {
      return this.readTextFile(this.globalMemoriesPath());
    }
    return this.readTextFile(this.projectMemoriesPath(this.resolveProjectSlug()));
  }

  /**
   * Persists memories for the given scope.
   * Project scope uses the current project slug, falling back to `"default"`.
   */
  saveMemories(scope: 'global' | 'project', content: string): void {
    if (scope === 'global') {
      this.writeTextFile(this.globalMemoriesPath(), content);
      return;
    }
    this.writeTextFile(this.projectMemoriesPath(this.resolveProjectSlug()), content);
  }

  /**
   * Loads a previously saved project snapshot for stale-detection.
   * Returns null when no snapshot exists for the slug.
   */
  loadProjectSnapshot(slug: string): ProjectSnapshot | null {
    try {
      const raw = fs.readFileSync(this.projectSnapshotPath(slug), 'utf-8');
      return JSON.parse(raw) as ProjectSnapshot;
    } catch {
      return null;
    }
  }

  /** Persists a project snapshot for stale-detection. */
  saveProjectSnapshot(slug: string, snapshot: ProjectSnapshot): void {
    try {
      const snapshotPath = this.projectSnapshotPath(slug);
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save project snapshot:', err);
      throw err;
    }
  }

  /**
   * Returns the Live session handle ID stored alongside a project's history.
   * Used to detect whether the same fingerprint was loaded in a new Live session.
   * Returns null when no handle has been stored yet.
   */
  loadProjectSessionHandle(slug: string): string | null {
    try {
      return fs.readFileSync(path.join(this.projectDir(slug), 'session-handle.txt'), 'utf-8');
    } catch {
      return null;
    }
  }

  /** Persists the main-track handle ID for the given project slug. */
  saveProjectSessionHandle(slug: string, handleId: string): void {
    try {
      const dir = this.projectDir(slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'session-handle.txt'), handleId, 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save project session handle:', err);
      throw err;
    }
  }

  /**
   * Loads global and project-scoped instructions and memories for prompt assembly.
   */
  loadPromptContext(): PromptContext {
    return {
      globalInstructions: this.loadInstructions('global'),
      projectInstructions: this.loadInstructions('project'),
      globalMemories: this.loadMemories('global'),
      projectMemories: this.loadMemories('project'),
    };
  }
}
