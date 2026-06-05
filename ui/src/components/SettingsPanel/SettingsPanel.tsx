import { useState } from 'react';
import { ApiKeyField, getKeyInputValue } from '../ApiKeyField';
import type { ProvidersRegistry, SettingsPayload } from '../../types';

interface SettingsPanelProps {
  providers: ProvidersRegistry;
  settings: SettingsPayload | null;
  onSave: (payload: { keys: Record<string, string> }) => void;
  onClearKey: (provider: string) => void;
  onOpenUrl: (url: string) => void;
}

const KEY_PLACEHOLDERS: Record<string, string> = {
  openai: 'sk-…',
  anthropic: 'sk-ant-…',
  gemini: 'AIza…',
};

const PROVIDER_ORDER = ['openai', 'anthropic', 'gemini'];

/** Settings panel for API keys. */
export function SettingsPanel({
  providers,
  settings,
  onSave,
  onClearKey,
  onOpenUrl,
}: SettingsPanelProps) {
  const [feedback, setFeedback] = useState('');

  function handleSave() {
    const keys: Record<string, string> = {};
    for (const id of PROVIDER_ORDER) {
      keys[id] = getKeyInputValue(id);
    }
    onSave({ keys });
    setFeedback('Saved ✓');
    setTimeout(() => setFeedback(''), 2500);
  }

  function handleExternalLink(e: React.MouseEvent<HTMLAnchorElement>, url: string) {
    e.preventDefault();
    onOpenUrl(url);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-text-dim">
          API Keys
        </h2>
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
