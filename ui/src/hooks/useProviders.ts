import { useMemo, useState } from 'react';
import type { ProvidersRegistry } from '../types';

/** Static provider/model registry. */
const PROVIDERS: ProvidersRegistry = {
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-5.5', label: 'GPT-5.5' },
      { id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
      { id: 'o3', label: 'o3' },
      { id: 'o3-pro', label: 'o3 Pro' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ],
  },
  gemini: {
    label: 'Google Gemini',
    models: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    ],
  },
};

export interface UseProvidersReturn {
  providers: ProvidersRegistry;
  provider: string;
  model: string;
  models: { id: string; label: string }[];
  setProvider: (p: string) => void;
  setModel: (m: string) => void;
}

/**
 * Manages the currently selected provider and model.
 * When the provider changes the model resets to the first available.
 */
export function useProviders(
  initialProvider = 'openai',
  initialModel?: string,
): UseProvidersReturn {
  const [provider, setProviderRaw] = useState(initialProvider);
  const [model, setModel] = useState(initialModel ?? PROVIDERS[initialProvider].models[0].id);

  const models = useMemo(() => PROVIDERS[provider]?.models ?? [], [provider]);

  function setProvider(p: string) {
    setProviderRaw(p);
    const firstModel = PROVIDERS[p]?.models[0]?.id ?? '';
    setModel(firstModel);
  }

  return { providers: PROVIDERS, provider, model, models, setProvider, setModel };
}
