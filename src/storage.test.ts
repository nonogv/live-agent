import { describe, it, expect, afterEach } from 'vitest';
import { Storage, projectNameToSlug } from './storage.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmpDirs: string[] = [];

function makeStorage(): Storage {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
  tmpDirs.push(dir);
  return new Storage(dir);
}

function makeStorageAt(dir: string): Storage {
  return new Storage(dir);
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

describe('Storage — API keys', () => {
  it('returns undefined for an unset provider key', () => {
    const s = makeStorage();
    expect(s.getApiKey('openai')).toBeUndefined();
    expect(s.getApiKey('anthropic')).toBeUndefined();
    expect(s.getApiKey('gemini')).toBeUndefined();
  });

  it('sets and gets an API key', () => {
    const s = makeStorage();
    s.setApiKey('openai', 'sk-test-123');
    expect(s.getApiKey('openai')).toBe('sk-test-123');
  });

  it('sets keys for multiple providers independently', () => {
    const s = makeStorage();
    s.setApiKey('openai', 'sk-openai');
    s.setApiKey('gemini', 'AIza-gemini');
    expect(s.getApiKey('openai')).toBe('sk-openai');
    expect(s.getApiKey('gemini')).toBe('AIza-gemini');
    expect(s.getApiKey('anthropic')).toBeUndefined();
  });

  it('overwrites an existing key', () => {
    const s = makeStorage();
    s.setApiKey('openai', 'sk-old');
    s.setApiKey('openai', 'sk-new');
    expect(s.getApiKey('openai')).toBe('sk-new');
  });
});

describe('Storage — persistence', () => {
  it('persists a key to disk and reloads it on next instantiation', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);

    const s1 = makeStorageAt(dir);
    s1.setApiKey('gemini', 'AIza-persistent');

    const s2 = makeStorageAt(dir);
    expect(s2.getApiKey('gemini')).toBe('AIza-persistent');
  });

  it('persists last choice to disk and reloads it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);

    const s1 = makeStorageAt(dir);
    s1.saveLastChoice('anthropic', 'claude-opus-4-8');

    const s2 = makeStorageAt(dir);
    expect(s2.getLastProvider()).toBe('anthropic');
    expect(s2.getLastModel()).toBe('claude-opus-4-8');
  });
});

describe('Storage — last provider/model', () => {
  it('returns gemini and empty model when unset', () => {
    const s = makeStorage();
    expect(s.getLastProvider()).toBe('gemini');
    expect(s.getLastModel()).toBe('');
  });

  it('saves and returns last provider and model', () => {
    const s = makeStorage();
    s.saveLastChoice('gemini', 'gemini-3.5-flash');
    expect(s.getLastProvider()).toBe('gemini');
    expect(s.getLastModel()).toBe('gemini-3.5-flash');
  });
});

describe('Storage — migration from default fields', () => {
  it('migrates defaultProvider to lastProvider when lastProvider is unset', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);
    fs.writeFileSync(
      path.join(dir, 'settings.json'),
      JSON.stringify({ apiKeys: {}, defaultProvider: 'openai' }),
    );

    const s = makeStorageAt(dir);
    expect(s.getLastProvider()).toBe('openai');
  });

  it('migrates defaultModel to lastModel when lastModel is unset', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);
    fs.writeFileSync(
      path.join(dir, 'settings.json'),
      JSON.stringify({ apiKeys: {}, defaultModel: 'gpt-4o-mini' }),
    );

    const s = makeStorageAt(dir);
    expect(s.getLastModel()).toBe('gpt-4o-mini');
  });

  it('removes legacy default fields from persisted JSON on migration', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);
    fs.writeFileSync(
      path.join(dir, 'settings.json'),
      JSON.stringify({
        apiKeys: { openai: 'sk-legacy' },
        defaultProvider: 'openai',
        defaultModel: 'gpt-4o-mini',
      }),
    );

    makeStorageAt(dir);
    const persisted = JSON.parse(
      fs.readFileSync(path.join(dir, 'settings.json'), 'utf-8'),
    ) as Record<string, unknown>;

    expect(persisted.lastProvider).toBe('openai');
    expect(persisted.lastModel).toBe('gpt-4o-mini');
    expect(persisted.defaultProvider).toBeUndefined();
    expect(persisted.defaultModel).toBeUndefined();
  });

  it('does not overwrite existing lastProvider/lastModel with legacy defaults', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);
    fs.writeFileSync(
      path.join(dir, 'settings.json'),
      JSON.stringify({
        apiKeys: {},
        lastProvider: 'gemini',
        lastModel: 'gemini-3.5-flash',
        defaultProvider: 'openai',
        defaultModel: 'gpt-4o-mini',
      }),
    );

    const s = makeStorageAt(dir);
    expect(s.getLastProvider()).toBe('gemini');
    expect(s.getLastModel()).toBe('gemini-3.5-flash');
  });
});

describe('Storage — masked keys', () => {
  it('returns empty strings for all unset keys', () => {
    const s = makeStorage();
    const masked = s.getMaskedKeys();
    expect(masked.openai).toBe('');
    expect(masked.anthropic).toBe('');
    expect(masked.gemini).toBe('');
  });

  it('returns a mask for set keys and empty string for unset', () => {
    const s = makeStorage();
    s.setApiKey('openai', 'sk-very-secret');
    const masked = s.getMaskedKeys();
    expect(masked.openai).toBe('••••••••');
    expect(masked.anthropic).toBe('');
    expect(masked.gemini).toBe('');
  });

  it('masks all three providers when all are set', () => {
    const s = makeStorage();
    s.setApiKey('openai', 'sk-a');
    s.setApiKey('anthropic', 'sk-b');
    s.setApiKey('gemini', 'sk-c');
    const masked = s.getMaskedKeys();
    expect(masked.openai).toBe('••••••••');
    expect(masked.anthropic).toBe('••••••••');
    expect(masked.gemini).toBe('••••••••');
  });
});

describe('Storage — conversation history', () => {
  it('round-trips saveHistory / loadHistory', () => {
    const s = makeStorage();
    const messages = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
      { role: 'user' as const, content: 'How are you?' },
    ];
    s.saveHistory(messages);
    expect(s.loadHistory()).toEqual(messages);
  });

  it('returns [] when no history file exists', () => {
    const s = makeStorage();
    expect(s.loadHistory()).toEqual([]);
  });

  it('caps history at 100 messages (trims oldest)', () => {
    const s = makeStorage();
    const messages = Array.from({ length: 110 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }));
    s.saveHistory(messages);
    const loaded = s.loadHistory();
    expect(loaded).toHaveLength(100);
    expect(loaded[0].content).toBe('Message 10');
    expect(loaded[99].content).toBe('Message 109');
  });

  it('returns [] when history.json contains invalid JSON', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, 'history.json'), 'not valid json {{{{');
    const s = makeStorageAt(dir);
    expect(s.loadHistory()).toEqual([]);
  });

  it('clearHistory makes loadHistory return []', () => {
    const s = makeStorage();
    const messages = [{ role: 'user' as const, content: 'Hello' }];
    s.saveHistory(messages);
    expect(s.loadHistory()).toHaveLength(1);
    s.clearHistory();
    expect(s.loadHistory()).toEqual([]);
  });
});

describe('Storage — project slug', () => {
  it('derives a slug from the project name', () => {
    expect(projectNameToSlug('My House Set 2026')).toBe('my-house-set-2026');
  });
});

describe('Storage — current project', () => {
  it('round-trips saveCurrentProject / loadCurrentProject / clearCurrentProject', () => {
    const s = makeStorage();
    expect(s.loadCurrentProject()).toBeNull();

    const saved = s.saveCurrentProject('My House Set 2026');
    expect(saved).toEqual({ name: 'My House Set 2026', slug: 'my-house-set-2026' });
    expect(s.loadCurrentProject()).toEqual(saved);

    s.clearCurrentProject();
    expect(s.loadCurrentProject()).toBeNull();
  });

  it('persists current project across Storage instances', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);

    const s1 = makeStorageAt(dir);
    s1.saveCurrentProject('Deep House');

    const s2 = makeStorageAt(dir);
    expect(s2.loadCurrentProject()).toEqual({
      name: 'Deep House',
      slug: 'deep-house',
    });
  });
});

describe('Storage — per-project history', () => {
  it('uses slug "default" when no project is set', () => {
    const s = makeStorage();
    const messages = [{ role: 'user' as const, content: 'Hello default' }];
    s.saveHistory(messages);
    expect(s.loadHistory()).toEqual(messages);
    expect(s.loadHistory('default')).toEqual(messages);
  });

  it('isolates history between projects', () => {
    const s = makeStorage();
    const projectA = s.saveCurrentProject('Project Alpha');
    const messagesA = [{ role: 'user' as const, content: 'Alpha chat' }];
    s.saveHistory(messagesA);

    const projectB = s.saveCurrentProject('Project Beta');
    const messagesB = [{ role: 'user' as const, content: 'Beta chat' }];
    s.saveHistory(messagesB);

    expect(s.loadHistory(projectB.slug)).toEqual(messagesB);
    expect(s.loadHistory(projectA.slug)).toEqual(messagesA);
    expect(s.loadHistory()).toEqual(messagesB);
  });

  it('clearHistory only removes history for the resolved slug', () => {
    const s = makeStorage();
    s.saveCurrentProject('Project Alpha');
    s.saveHistory([{ role: 'user' as const, content: 'Alpha' }], 'project-alpha');

    s.saveCurrentProject('Project Beta');
    s.saveHistory([{ role: 'user' as const, content: 'Beta' }], 'project-beta');

    s.clearHistory('project-alpha');
    expect(s.loadHistory('project-alpha')).toEqual([]);
    expect(s.loadHistory('project-beta')).toEqual([{ role: 'user', content: 'Beta' }]);
  });
});

describe('Storage — legacy history migration', () => {
  it('copies root history.json to projects/default/history.json once', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);

    const legacyMessages = [{ role: 'user' as const, content: 'Legacy chat' }];
    fs.writeFileSync(path.join(dir, 'history.json'), JSON.stringify(legacyMessages));

    const s = makeStorageAt(dir);
    expect(s.loadHistory()).toEqual(legacyMessages);
    expect(s.loadHistory('default')).toEqual(legacyMessages);
    expect(fs.existsSync(path.join(dir, 'projects', 'default', 'history.json'))).toBe(true);

    const s2 = makeStorageAt(dir);
    expect(s2.loadHistory('default')).toEqual(legacyMessages);
  });

  it('does not overwrite an existing projects/default/history.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-test-'));
    tmpDirs.push(dir);

    const legacyMessages = [{ role: 'user' as const, content: 'Legacy only' }];
    const defaultMessages = [{ role: 'user' as const, content: 'Already migrated' }];
    fs.writeFileSync(path.join(dir, 'history.json'), JSON.stringify(legacyMessages));
    fs.mkdirSync(path.join(dir, 'projects', 'default'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'projects', 'default', 'history.json'),
      JSON.stringify(defaultMessages),
    );

    const s = makeStorageAt(dir);
    expect(s.loadHistory('default')).toEqual(defaultMessages);
  });
});

describe('Storage — instructions and memories', () => {
  it('round-trips global instructions and memories', () => {
    const s = makeStorage();
    s.saveInstructions('global', 'Always use sidechain compression.');
    s.saveMemories('global', 'User prefers minimal techno.');

    expect(s.loadInstructions('global')).toBe('Always use sidechain compression.');
    expect(s.loadMemories('global')).toBe('User prefers minimal techno.');
  });

  it('round-trips project instructions and memories for the current project', () => {
    const s = makeStorage();
    s.saveCurrentProject('My House Set 2026');
    s.saveInstructions('project', 'Keep vocals dry.');
    s.saveMemories('project', 'Kick is on track 1.');

    expect(s.loadInstructions('project')).toBe('Keep vocals dry.');
    expect(s.loadMemories('project')).toBe('Kick is on track 1.');
  });

  it('uses slug "default" for project scope when no project is set', () => {
    const s = makeStorage();
    s.saveInstructions('project', 'Default project instructions');
    s.saveMemories('project', 'Default project memories');

    expect(s.loadInstructions('project')).toBe('Default project instructions');
    expect(s.loadMemories('project')).toBe('Default project memories');
  });

  it('loadPromptContext returns all four context fields', () => {
    const s = makeStorage();
    s.saveInstructions('global', 'Global rules');
    s.saveMemories('global', 'Global memories');
    s.saveCurrentProject('Live Set');
    s.saveInstructions('project', 'Project rules');
    s.saveMemories('project', 'Project memories');

    expect(s.loadPromptContext()).toEqual({
      globalInstructions: 'Global rules',
      globalMemories: 'Global memories',
      projectInstructions: 'Project rules',
      projectMemories: 'Project memories',
    });
  });
});

describe('Storage — project snapshot', () => {
  it('returns null when no snapshot exists', () => {
    const s = makeStorage();
    expect(s.loadProjectSnapshot('my-set')).toBeNull();
  });

  it('round-trips saveProjectSnapshot / loadProjectSnapshot', () => {
    const s = makeStorage();
    const snapshot = {
      trackCount: 8,
      trackNames: ['Kick', 'Snare', 'Hat'],
      tempo: 124,
    };
    s.saveProjectSnapshot('my-set', snapshot);
    expect(s.loadProjectSnapshot('my-set')).toEqual(snapshot);
  });
});
