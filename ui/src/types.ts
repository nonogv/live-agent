/** All message roles that can appear in the chat panel. */
export type MessageRole = 'user' | 'agent' | 'tool' | 'error';

/** A single message in the chat history. */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  /** Text content; may grow incrementally during streaming. */
  content: string;
  /** Tool name, set for role === 'tool'. */
  toolName?: string;
  /** Tool args, set for role === 'tool'. */
  toolArgs?: unknown;
  /** Whether this message is still being streamed. */
  streaming?: boolean;
}

/** A single model entry within a provider. */
export interface ModelEntry {
  id: string;
  label: string;
}

/** A provider with its available models. */
export interface ProviderEntry {
  label: string;
  models: ModelEntry[];
}

/** The full provider/model registry. */
export type ProvidersRegistry = Record<string, ProviderEntry>;

/** Settings payload received from the backend. */
export interface SettingsPayload {
  type: 'settings';
  /** Map of provider → masked key string (truthy = set). */
  keys: Record<string, string | null>;
  defaultProvider: string;
  defaultModel: string;
}

// ── WebSocket message types (server → client) ──────────────────────────────

export type ServerMessage =
  | { type: 'ready' }
  | { type: 'stream_start' }
  | { type: 'stream_chunk'; text: string }
  | { type: 'stream_end' }
  | { type: 'tool_start'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'error'; message: string }
  | { type: 'history_cleared' }
  | SettingsPayload
  | { type: 'settings_saved' }
  | { type: 'key_cleared'; provider: string };

// ── WebSocket message types (client → server) ──────────────────────────────

export type ClientMessage =
  | { type: 'chat'; text: string; provider: string; model: string }
  | { type: 'clear_history' }
  | { type: 'get_settings' }
  | {
      type: 'save_settings';
      keys: Record<string, string>;
      defaultProvider: string;
      defaultModel: string;
    }
  | { type: 'clear_key'; provider: string }
  | { type: 'open_url'; url: string }
  | { type: 'console_log'; level: string; message: string }
  | { type: 'debug'; provider: string; model: string };
