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

/** Metadata stored alongside a saved conversation session. */
export interface SessionMeta {
  /** UUID generated at extension startup — unique per Live-app lifetime. */
  id: string;
  /** ISO timestamp of when the session started. */
  startedAt: string;
  /** User-assigned name, if any. */
  name?: string;
  /** First user message, truncated to ~80 chars, auto-populated after first turn. */
  preview?: string;
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
   * Returns all named projects (those whose slug does not start with "session-")
   * sorted alphabetically by name.  Used to populate the "resume project" list.
   */
  listNamedProjects(): ProjectInfo[] {
    const projectsDir = path.join(this.storageDirectory, 'projects');
    try {
      const slugs = fs
        .readdirSync(projectsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('session-'))
        .map((entry) => entry.name);

      return slugs
        .map((slug) => this.loadProjectBySlug(slug))
        .filter((p): p is ProjectInfo => p !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  /**
   * Loads project metadata from its slug directory.
   * Returns null when the directory or metadata file is missing.
   */
  loadProjectBySlug(slug: string): ProjectInfo | null {
    try {
      const metaPath = path.join(this.projectDir(slug), 'project.json');
      const raw = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(raw) as ProjectInfo;
    } catch {
      return null;
    }
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
      // Write global current-project pointer.
      fs.mkdirSync(path.dirname(this.currentProjectFilePath()), { recursive: true });
      fs.writeFileSync(this.currentProjectFilePath(), JSON.stringify(project, null, 2), 'utf-8');

      // Write per-project metadata so loadProjectBySlug() can read it later.
      const projectDir = this.projectDir(project.slug);
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, 'project.json'),
        JSON.stringify(project, null, 2),
        'utf-8',
      );
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

  // ─── Session storage ─────────────────────────────────────────────────────

  private sessionDir(sessionId: string): string {
    return path.join(this.storageDirectory, 'sessions', sessionId);
  }

  /** Persists session metadata (creates the session directory if needed). */
  saveSessionMeta(sessionId: string, meta: SessionMeta): void {
    try {
      const dir = this.sessionDir(sessionId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save session meta:', err);
      throw err;
    }
  }

  /** Loads session metadata. Returns null when the session does not exist. */
  loadSessionMeta(sessionId: string): SessionMeta | null {
    try {
      const raw = fs.readFileSync(path.join(this.sessionDir(sessionId), 'meta.json'), 'utf-8');
      return JSON.parse(raw) as SessionMeta;
    } catch {
      return null;
    }
  }

  /** Persists the conversation history for a session. */
  saveSessionHistory(sessionId: string, messages: ProviderMessage[]): void {
    try {
      const dir = this.sessionDir(sessionId);
      fs.mkdirSync(dir, { recursive: true });
      const trimmed = messages.slice(-HISTORY_MAX_MESSAGES);
      fs.writeFileSync(path.join(dir, 'history.json'), JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Live Agent] Failed to save session history:', err);
      throw err;
    }
  }

  /** Loads the conversation history for a session. Returns [] when not found. */
  loadSessionHistory(sessionId: string): ProviderMessage[] {
    try {
      const raw = fs.readFileSync(path.join(this.sessionDir(sessionId), 'history.json'), 'utf-8');
      return JSON.parse(raw) as ProviderMessage[];
    } catch {
      return [];
    }
  }

  /**
   * Returns all saved sessions sorted newest-first.
   * Sessions with no history (empty conversations) are excluded.
   */
  listSessions(): SessionMeta[] {
    const sessionsDir = path.join(this.storageDirectory, 'sessions');
    try {
      const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
      const metas: SessionMeta[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const meta = this.loadSessionMeta(entry.name);
        if (!meta) continue;
        // Skip sessions with no actual messages.
        const histPath = path.join(this.sessionDir(entry.name), 'history.json');
        if (!fs.existsSync(histPath)) continue;
        metas.push(meta);
      }
      return metas.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
    } catch {
      return [];
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
