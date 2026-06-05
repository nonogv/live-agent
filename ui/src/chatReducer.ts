import type { ChatMessage } from './types.js';

/** Actions that update chat message state. */
export type ChatAction =
  | { type: 'LOAD_HISTORY'; messages: Array<{ role: 'user' | 'agent'; content: string }> }
  | { type: 'ADD_USER'; text: string }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_CHUNK'; text: string }
  | { type: 'STREAM_END' }
  | { type: 'FOLD_TOOL_MESSAGES' }
  | { type: 'TOGGLE_TOOL_FOLD'; id: string }
  | { type: 'TOOL_START'; name: string; args: unknown }
  | { type: 'CONFIRM_REQUEST'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'CONFIRM_RESPOND'; toolCallId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'TURN_COMMITTED' }
  | { type: 'CLEAR' };

/** Chat panel state managed by {@link chatReducer}. */
export interface ChatState {
  messages: ChatMessage[];
  streaming: boolean;
}

let msgId = 0;
function nextId() {
  return String(++msgId);
}

/** Resets the message id counter — for tests only. */
export function resetChatMessageIds(): void {
  msgId = 0;
}

/**
 * Reducer for chat message list and streaming state.
 * @param state - Current chat state.
 * @param action - State transition to apply.
 */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'LOAD_HISTORY':
      return {
        ...state,
        messages: action.messages.map((m) => ({
          id: nextId(),
          role: m.role,
          content: m.content,
        })),
      };

    case 'ADD_USER':
      return {
        ...state,
        messages: [...state.messages, { id: nextId(), role: 'user', content: action.text }],
      };

    case 'STREAM_START':
      return {
        ...state,
        streaming: true,
        messages: [
          ...state.messages,
          { id: nextId(), role: 'agent', content: '', streaming: true },
        ],
      };

    case 'STREAM_CHUNK': {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.streaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + action.text };
      } else {
        msgs.push({ id: nextId(), role: 'agent', content: action.text, streaming: true });
      }
      return { ...state, streaming: true, messages: msgs };
    }

    case 'STREAM_END': {
      const msgs = state.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m));
      return { ...state, streaming: false, messages: msgs };
    }

    case 'FOLD_TOOL_MESSAGES':
      return {
        ...state,
        messages: state.messages.map((m) => (m.role === 'tool' ? { ...m, folded: true } : m)),
      };

    case 'TOGGLE_TOOL_FOLD':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, folded: !m.folded } : m)),
      };

    case 'TOOL_START':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: nextId(),
            role: 'tool',
            content: '',
            toolName: action.name,
            toolArgs: action.args,
          },
        ],
      };

    case 'CONFIRM_REQUEST':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: `confirm-${action.toolCallId}`,
            role: 'confirm',
            content: '',
            toolName: action.toolName,
            toolArgs: action.args,
            toolCallId: action.toolCallId,
          },
        ],
      };

    case 'CONFIRM_RESPOND':
      return {
        ...state,
        messages: state.messages.filter((m) => m.toolCallId !== action.toolCallId),
      };

    case 'ERROR':
      return {
        ...state,
        streaming: false,
        messages: [...state.messages, { id: nextId(), role: 'error', content: action.message }],
      };

    case 'TURN_COMMITTED':
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: nextId(), role: 'hint', content: '⌘Z to revert this turn' },
        ],
      };

    case 'CLEAR':
      return { messages: [], streaming: false };

    default:
      return state;
  }
}
