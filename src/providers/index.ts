import {
  openaiStream,
  anthropicStream,
  geminiStream,
  type ProviderMsg,
  type ToolSchema as HttpToolSchema,
  type HttpChunk,
} from './http-stream.js';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type { ProviderMsg as ProviderMessage };

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> };

export interface ChatOptions {
  model: string;
  systemPrompt: string;
  messages: ProviderMsg[];
  tools: ToolSchema[];
}

export interface ProviderAdapter {
  chat(options: ChatOptions): AsyncIterable<StreamChunk>;
}

// ─── Known models ─────────────────────────────────────────────────────────────

export const PROVIDERS = {
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
    default: 'gpt-5.4-mini',
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ],
    default: 'claude-sonnet-4-6',
  },
  gemini: {
    label: 'Google Gemini',
    models: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    ],
    default: 'gemini-3.5-flash',
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Adapts the http-stream generators to the ProviderAdapter interface. */
function makeAdapter(
  fn: (
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: ProviderMsg[],
    tools: HttpToolSchema[],
  ) => AsyncGenerator<HttpChunk>,
): (apiKey: string) => ProviderAdapter {
  return (apiKey) => ({
    chat({ model, systemPrompt, messages, tools }): AsyncIterable<StreamChunk> {
      return fn(
        apiKey,
        model,
        systemPrompt,
        messages,
        tools as HttpToolSchema[],
      ) as AsyncIterable<StreamChunk>;
    },
  });
}

const adapters = {
  openai: makeAdapter(openaiStream),
  anthropic: makeAdapter(anthropicStream),
  gemini: makeAdapter(geminiStream),
};

export function createProvider(providerId: string, apiKey: string): ProviderAdapter {
  const factory = adapters[providerId as keyof typeof adapters];
  if (!factory) throw new Error(`Unknown provider: ${providerId}`);
  return factory(apiKey);
}
