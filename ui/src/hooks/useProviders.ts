import { useCallback, useMemo, useState } from 'react';
import type { ProvidersRegistry } from '../types';

/** Static provider/model registry. */
export const PROVIDERS: ProvidersRegistry = {
  openai: {
    label: 'OpenAI',
    default: 'gpt-5.4-mini',
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
    default: 'claude-haiku-4-5',
    models: [
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ],
  },
  gemini: {
    label: 'Google Gemini',
    default: 'gemini-3.1-flash-lite',
    models: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    ],
  },
};

const FALLBACK_PROVIDER = 'gemini';

/**
 * Returns the default model id for a provider, or an empty string when unknown.
 * @param providerId - Provider key from {@link PROVIDERS}.
 */
export function getProviderDefaultModel(providerId: string): string {
  return PROVIDERS[providerId]?.default ?? '';
}

/**
 * Resolves provider/model from persisted last-used values with free-tier defaults.
 * @param lastProvider - Persisted provider id, if any.
 * @param lastModel - Persisted model id, if any.
 */
export function resolveProviderChoice(
  lastProvider?: string,
  lastModel?: string,
): { provider: string; model: string } {
  const provider = lastProvider ?? FALLBACK_PROVIDER;
  const providerModels = PROVIDERS[provider]?.models ?? [];
  const defaultModel = getProviderDefaultModel(provider);
  const model =
    lastModel && providerModels.some((entry) => entry.id === lastModel) ? lastModel : defaultModel;
  return { provider, model };
}

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
 * When the provider changes the model resets to that provider's default unless
 * a persisted lastModel is supplied via initFromLastChoice.
 */
export function useProviders(
  onChoiceChange?: (provider: string, model: string) => void,
): UseProvidersReturn {
  const [provider, setProviderRaw] = useState(FALLBACK_PROVIDER);
  const [model, setModelRaw] = useState(getProviderDefaultModel(FALLBACK_PROVIDER));

  const models = useMemo(() => PROVIDERS[provider]?.models ?? [], [provider]);

  const notifyChange = useCallback(
    (p: string, m: string) => {
      onChoiceChange?.(p, m);
    },
    [onChoiceChange],
  );

  const initFromLastChoice = useCallback((lastProvider?: string, lastModel?: string) => {
    const resolved = resolveProviderChoice(lastProvider, lastModel);
    setProviderRaw(resolved.provider);
    setModelRaw(resolved.model);
  }, []);

  const setProvider = useCallback(
    (p: string) => {
      const defaultModel = getProviderDefaultModel(p);
      setProviderRaw(p);
      setModelRaw(defaultModel);
      notifyChange(p, defaultModel);
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
