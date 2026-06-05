import { useCallback, useMemo, useState } from 'react';
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
  /** Applies persisted last-used provider/model from a settings message. */
  initFromLastChoice: (lastProvider?: string, lastModel?: string) => void;
}

/**
 * Manages the currently selected provider and model.
 * When the provider changes the model resets to the first available unless
 * a persisted lastModel is supplied via initFromLastChoice.
 */
export function useProviders(
  onChoiceChange?: (provider: string, model: string) => void,
): UseProvidersReturn {
  const [provider, setProviderRaw] = useState('anthropic');
  const [model, setModelRaw] = useState(PROVIDERS.anthropic.models[0].id);

  const models = useMemo(() => PROVIDERS[provider]?.models ?? [], [provider]);

  const notifyChange = useCallback(
    (p: string, m: string) => {
      onChoiceChange?.(p, m);
    },
    [onChoiceChange],
  );

  const initFromLastChoice = useCallback((lastProvider?: string, lastModel?: string) => {
    const p = lastProvider ?? 'anthropic';
    const providerModels = PROVIDERS[p]?.models ?? [];
    const m =
      lastModel && providerModels.some((entry) => entry.id === lastModel)
        ? lastModel
        : (providerModels[0]?.id ?? '');
    setProviderRaw(p);
    setModelRaw(m);
  }, []);

  const setProvider = useCallback(
    (p: string) => {
      const firstModel = PROVIDERS[p]?.models[0]?.id ?? '';
      setProviderRaw(p);
      setModelRaw(firstModel);
      notifyChange(p, firstModel);
    },
    [notifyChange],
  );

  const setModel = useCallback(
    (m: string) => {
      setModelRaw(m);
      notifyChange(provider, m);
    },
    [notifyChange, provider],
  );

  return {
    providers: PROVIDERS,
    provider,
    model,
    models,
    setProvider,
    setModel,
    initFromLastChoice,
  };
}
