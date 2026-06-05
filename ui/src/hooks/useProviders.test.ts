import { describe, it, expect } from 'vitest';
import { getProviderDefaultModel, resolveProviderChoice } from './useProviders.js';

describe('getProviderDefaultModel', () => {
  it('returns the cheapest default for each known provider', () => {
    expect(getProviderDefaultModel('openai')).toBe('gpt-5.4-mini');
    expect(getProviderDefaultModel('anthropic')).toBe('claude-haiku-4-5');
    expect(getProviderDefaultModel('gemini')).toBe('gemini-3.1-flash-lite');
  });

  it('returns empty string for unknown providers', () => {
    expect(getProviderDefaultModel('unknown')).toBe('');
  });
});

describe('resolveProviderChoice', () => {
  it('falls back to gemini and flash-lite when unset', () => {
    expect(resolveProviderChoice()).toEqual({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
    });
  });

  it('uses persisted provider and model when valid', () => {
    expect(resolveProviderChoice('openai', 'gpt-5.4')).toEqual({
      provider: 'openai',
      model: 'gpt-5.4',
    });
  });

  it('falls back to provider default when model is invalid', () => {
    expect(resolveProviderChoice('anthropic', 'not-a-model')).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    });
  });
});
