import { useState } from 'react';
import styles from './SettingsPanel.module.scss';
import { ApiKeyField, getKeyInputValue } from './ApiKeyField';
import type { ProvidersRegistry, SettingsPayload } from '../types';

interface SettingsPanelProps {
  providers: ProvidersRegistry;
  settings: SettingsPayload | null;
  onSave: (payload: {
    keys: Record<string, string>;
    defaultProvider: string;
    defaultModel: string;
  }) => void;
  onClearKey: (provider: string) => void;
  onOpenUrl: (url: string) => void;
}

const KEY_PLACEHOLDERS: Record<string, string> = {
  openai: 'sk-…',
  anthropic: 'sk-ant-…',
  gemini: 'AIza…',
};

const PROVIDER_ORDER = ['openai', 'anthropic', 'gemini'];

/** Settings panel for API keys and default model selection. */
export function SettingsPanel({
  providers,
  settings,
  onSave,
  onClearKey,
  onOpenUrl,
}: SettingsPanelProps) {
  const [defaultProvider, setDefaultProvider] = useState(settings?.defaultProvider ?? 'openai');
  const [defaultModel, setDefaultModel] = useState(settings?.defaultModel ?? '');
  const [feedback, setFeedback] = useState('');

  // Update local state when settings arrive from server
  if (settings && settings.defaultProvider !== defaultProvider) {
    setDefaultProvider(settings.defaultProvider);
  }
  if (settings && settings.defaultModel !== defaultModel) {
    setDefaultModel(settings.defaultModel);
  }

  const defaultModels = providers[defaultProvider]?.models ?? [];

  function handleSave() {
    const keys: Record<string, string> = {};
    for (const id of PROVIDER_ORDER) {
      keys[id] = getKeyInputValue(id);
    }
    onSave({ keys, defaultProvider, defaultModel });
    setFeedback('Saved ✓');
    setTimeout(() => setFeedback(''), 2500);
  }

  function handleProviderChange(p: string) {
    setDefaultProvider(p);
    const first = providers[p]?.models[0]?.id ?? '';
    setDefaultModel(first);
  }

  function handleExternalLink(e: React.MouseEvent<HTMLAnchorElement>, url: string) {
    e.preventDefault();
    onOpenUrl(url);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>API Keys</h2>
        <p className={styles.note}>
          Keys are stored locally in Live&apos;s extension storage and never leave your computer.
          Get keys from{' '}
          <a
            href="https://platform.openai.com"
            className={styles.extLink}
            onClick={(e) => handleExternalLink(e, 'https://platform.openai.com')}
          >
            OpenAI
          </a>
          ,{' '}
          <a
            href="https://console.anthropic.com"
            className={styles.extLink}
            onClick={(e) => handleExternalLink(e, 'https://console.anthropic.com')}
          >
            Anthropic
          </a>
          , or{' '}
          <a
            href="https://aistudio.google.com"
            className={styles.extLink}
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

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Default Model</h2>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="default-provider">
            Provider
          </label>
          <select
            id="default-provider"
            className={styles.select}
            value={defaultProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {Object.entries(providers).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="default-model-select">
            Model
          </label>
          <select
            id="default-model-select"
            className={styles.select}
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
          >
            {defaultModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className={styles.saveBtn} onClick={handleSave}>
        Save Settings
      </button>
      <div className={styles.feedback}>{feedback}</div>
    </div>
  );
}
