import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ProviderMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCall?: ToolCall;
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> };

export interface ChatOptions {
  model: string;
  systemPrompt: string;
  messages: ProviderMessage[];
  tools: ToolSchema[];
}

export interface ProviderAdapter {
  chat(options: ChatOptions): AsyncIterable<StreamChunk>;
}

// ─── Known models ─────────────────────────────────────────────────────────────

export const PROVIDERS = {
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
      { id: "o3-mini", label: "o3-mini" },
    ],
    default: "gpt-4o-mini",
  },
  anthropic: {
    label: "Anthropic",
    models: [
      { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "claude-haiku-3-5", label: "Claude Haiku 3.5" },
    ],
    default: "claude-sonnet-4-5",
  },
  gemini: {
    label: "Google Gemini",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
    default: "gemini-2.5-flash",
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createProvider(providerId: string, apiKey: string): ProviderAdapter {
  switch (providerId) {
    case "openai":
      return new OpenAIProvider(apiKey);
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "gemini":
      return new GeminiProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}
