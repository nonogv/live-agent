/** All message roles that can appear in the chat panel. */
export type MessageRole = 'user' | 'agent' | 'tool' | 'error' | 'confirm' | 'diagnostic';

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
  /** When true the message is omitted from the chat list (e.g. hidden tool calls). */
  hidden?: boolean;
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
  /** Cheapest/free default model for this provider. */
  default: string;
}

/** The full provider/model registry. */
export type ProvidersRegistry = Record<string, ProviderEntry>;

/** Active project identity from the backend. */
export interface ProjectState {
  name: string | null;
  slug: string | null;
}

/** Layered instructions and memories (global + per-project). */
export interface ContextState {
  globalInstructions: string;
  projectInstructions: string;
  globalMemories: string;
  projectMemories: string;
}

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
  | { type: 'tool_start'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'confirm_request'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'error'; message: string }
  | { type: 'history_cleared' }
  | SettingsPayload
  | { type: 'settings_saved' }
  | { type: 'key_cleared'; provider: string }
  | { type: 'history'; messages: Array<{ role: 'user' | 'agent'; content: string }> }
  | { type: 'project'; name: string | null; slug: string | null }
  | {
      type: 'context';
      globalInstructions: string;
      projectInstructions: string;
      globalMemories: string;
      projectMemories: string;
    }
  | { type: 'context_saved' }
  | { type: 'project_stale'; summary: string };

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
  | { type: 'confirm_response'; confirmed: boolean; toolCallId: string }
  | { type: 'set_project'; name: string }
  | { type: 'get_context' }
  | { type: 'save_instructions'; scope: 'global' | 'project'; content: string }
  | { type: 'save_memories'; scope: 'global' | 'project'; content: string }
  | { type: 'refresh_project_memories'; provider: string; model: string };
