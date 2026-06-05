/** All message roles that can appear in the chat panel. */
export type MessageRole = 'user' | 'agent' | 'tool' | 'error' | 'confirm' | 'hint';

/**
 * Confirmation mode for tool calls:
 * - review  — ask before every tool call
 * - guard   — ask only before destructive operations (default)
 * - off     — never ask, run everything automatically
 */
export type ConfirmMode = 'review' | 'guard' | 'off';

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
  /** Tool call ID, set for role === 'confirm'. */
  toolCallId?: string;
  /** Whether this message is still being streamed. */
  streaming?: boolean;
  /** Whether a tool message is collapsed to a one-liner. */
  folded?: boolean;
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
  lastProvider?: string;
  lastModel?: string;
}

// ── WebSocket message types (server → client) ──────────────────────────────

export type ServerMessage =
  | { type: 'ready' }
  | { type: 'stream_start' }
  | { type: 'stream_chunk'; text: string }
  | { type: 'stream_end' }
  | { type: 'turn_committed' }
  | { type: 'tool_start'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'confirm_request'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'error'; message: string }
  | { type: 'history_cleared' }
  | SettingsPayload
  | { type: 'settings_saved' }
  | { type: 'key_cleared'; provider: string }
  | { type: 'history'; messages: Array<{ role: 'user' | 'agent'; content: string }> };

// ── WebSocket message types (client → server) ──────────────────────────────

export type ClientMessage =
  | { type: 'chat'; text: string; provider: string; model: string }
  | { type: 'clear_history' }
  | { type: 'get_settings' }
  | { type: 'save_settings'; keys: Record<string, string> }
  | { type: 'set_active_choice'; provider: string; model: string }
  | { type: 'clear_key'; provider: string }
  | { type: 'open_url'; url: string }
  | { type: 'console_log'; level: string; message: string }
  | { type: 'debug'; provider: string; model: string }
  | { type: 'set_confirm_mode'; mode: ConfirmMode }
  | { type: 'confirm_response'; confirmed: boolean; toolCallId: string };
