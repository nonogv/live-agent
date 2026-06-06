import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApiKeyField, getKeyInputValue } from '../ApiKeyField';
import type { ContextState, ProvidersRegistry, SettingsPayload } from '../../types';

interface SettingsPanelProps {
  providers: ProvidersRegistry;
  settings: SettingsPayload | null;
  context: ContextState;
  onSave: (payload: { keys: Record<string, string> }) => void;
  onClearKey: (provider: string) => void;
  onOpenUrl: (url: string) => void;
  onClose: () => void;
  onSaveInstructions: (scope: 'global' | 'project', content: string) => void;
  onSaveMemories: (scope: 'global' | 'project', content: string) => void;
}

const KEY_PLACEHOLDERS: Record<string, string> = {
  openai: 'sk-…',
  anthropic: 'sk-ant-…',
  gemini: 'AIza…',
};

const PROVIDER_ORDER = ['openai', 'anthropic', 'gemini'];

const TEXTAREA_CLASS =
  'w-full resize-none rounded-default border border-border bg-surface2 px-2.5 py-2 text-[13px] text-text outline-none focus:outline focus:outline-1 focus:outline-accent';

/** Settings panel for API keys, project context, instructions, and memories. */
export function SettingsPanel({
  providers,
  settings,
  context,
  onSave,
  onClearKey,
  onOpenUrl,
  onClose,
  onSaveInstructions,
  onSaveMemories,
}: SettingsPanelProps) {
  const [feedback, setFeedback] = useState('');
  const [globalInstructions, setGlobalInstructions] = useState(context.globalInstructions);
  const [projectInstructions, setProjectInstructions] = useState(context.projectInstructions);
  const [globalMemories, setGlobalMemories] = useState(context.globalMemories);
  const [projectMemories, setProjectMemories] = useState(context.projectMemories);

  useEffect(() => {
    setGlobalInstructions(context.globalInstructions);
    setProjectInstructions(context.projectInstructions);
    setGlobalMemories(context.globalMemories);
    setProjectMemories(context.projectMemories);
  }, [
    context.globalInstructions,
    context.projectInstructions,
    context.globalMemories,
    context.projectMemories,
  ]);

  function showFeedback(message: string) {
    setFeedback(message);
    setTimeout(() => setFeedback(''), 2500);
  }

  function handleSave() {
    const keys: Record<string, string> = {};
    for (const id of PROVIDER_ORDER) {
      keys[id] = getKeyInputValue(id);
    }
    onSave({ keys });
    showFeedback('Saved ✓');
  }

  function handleSaveInstructions(scope: 'global' | 'project') {
    const content = scope === 'global' ? globalInstructions : projectInstructions;
    onSaveInstructions(scope, content);
    showFeedback('Instructions saved ✓');
  }

  function handleSaveMemories(scope: 'global' | 'project') {
    const content = scope === 'global' ? globalMemories : projectMemories;
    onSaveMemories(scope, content);
    showFeedback('Memories saved ✓');
  }

  function handleExternalLink(e: React.MouseEvent<HTMLAnchorElement>, url: string) {
    e.preventDefault();
    onOpenUrl(url);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-dim">Settings</h2>
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-default border-none bg-transparent p-0 text-text-dim transition-colors hover:bg-surface2 hover:text-text"
          onClick={onClose}
          title="Close settings"
          aria-label="Close settings"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mb-6">
        <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-text-dim">
          API Keys
        </h3>
        <p className="mb-4 text-[13px] leading-normal text-text-dim">
          Keys are stored locally in Live&apos;s extension storage and never leave your computer.
          Get keys from{' '}
          <a
            href="https://platform.openai.com"
            className="text-accent no-underline hover:underline"
            onClick={(e) => handleExternalLink(e, 'https://platform.openai.com')}
          >
            OpenAI
          </a>
          ,{' '}
          <a
            href="https://console.anthropic.com"
            className="text-accent no-underline hover:underline"
            onClick={(e) => handleExternalLink(e, 'https://console.anthropic.com')}
          >
            Anthropic
          </a>
          , or{' '}
          <a
            href="https://aistudio.google.com"
            className="text-accent no-underline hover:underline"
            onClick={(e) => handleExternalLink(e, 'https://aistudio.google.com')}
          >
            Google AI Studio
          </a>
          .
        </p>
        {PROVIDER_ORDER.map((id) => (
          <ApiKeyField
            key={id}
            providerId={id}
            label={providers[id]?.label ?? id}
            placeholder={KEY_PLACEHOLDERS[id] ?? ''}
            isSet={!!settings?.keys[id]}
            onClear={onClearKey}
          />
        ))}
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-text-dim">
          Instructions
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] text-text-dim" htmlFor="global-instructions">
              Global
            </label>
            <textarea
              id="global-instructions"
              className={TEXTAREA_CLASS}
              rows={4}
              value={globalInstructions}
              onChange={(event) => setGlobalInstructions(event.target.value)}
              placeholder="Always respond in English. Prefer minor scales."
            />
            <button
              type="button"
              className="mt-2 cursor-pointer rounded-default border border-border bg-surface2 px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent hover:text-accent"
              onClick={() => handleSaveInstructions('global')}
            >
              Save
            </button>
          </div>
          <div>
            <label
              className="mb-1.5 block text-[13px] text-text-dim"
              htmlFor="project-instructions"
            >
              This project
            </label>
            <textarea
              id="project-instructions"
              className={`${TEXTAREA_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              rows={4}
              value={projectInstructions}
              onChange={(event) => setProjectInstructions(event.target.value)}
              placeholder="This is a lo-fi hip-hop set. Tempo stays at 90 BPM."
            />
            <button
              type="button"
              className="mt-2 cursor-pointer rounded-default border border-border bg-surface2 px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handleSaveInstructions('project')}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-text-dim">
          Memories
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] text-text-dim" htmlFor="global-memories">
              Global
            </label>
            <textarea
              id="global-memories"
              className={TEXTAREA_CLASS}
              rows={4}
              value={globalMemories}
              onChange={(event) => setGlobalMemories(event.target.value)}
              placeholder="I'm a house music producer. I prefer four-on-the-floor kicks."
            />
            <button
              type="button"
              className="mt-2 cursor-pointer rounded-default border border-border bg-surface2 px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent hover:text-accent"
              onClick={() => handleSaveMemories('global')}
            >
              Save
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] text-text-dim" htmlFor="project-memories">
              This project
            </label>
            <textarea
              id="project-memories"
              className={`${TEXTAREA_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              rows={4}
              value={projectMemories}
              onChange={(event) => setProjectMemories(event.target.value)}
              placeholder="8 tracks. Main synth is Operator on Track 3."
            />
            <button
              type="button"
              className="mt-2 cursor-pointer rounded-default border border-border bg-surface2 px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handleSaveMemories('project')}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <button
        className="w-full cursor-pointer rounded-default border-none bg-accent py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
        onClick={handleSave}
      >
        Save Settings
      </button>
      <div className="mt-3 min-h-[20px] text-center text-[13px] text-[#6abf6a]">{feedback}</div>
    </div>
  );
}
