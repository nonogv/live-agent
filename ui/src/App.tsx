import { useCallback, useReducer, useRef, useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { ProviderBar } from './components/ProviderBar';
import { SettingsPanel } from './components/SettingsPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useProviders } from './hooks/useProviders';
import type {
  ChatMessage,
  ClientMessage,
  ConfirmMode,
  ServerMessage,
  SettingsPayload,
} from './types';

// ── Chat state via useReducer ────────────────────────────────────────────────

type ChatAction =
  | { type: 'LOAD_HISTORY'; messages: Array<{ role: 'user' | 'agent'; content: string }> }
  | { type: 'ADD_USER'; text: string }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_CHUNK'; text: string }
  | { type: 'STREAM_END' }
  | { type: 'TOOL_START'; name: string; args: unknown }
  | { type: 'CONFIRM_REQUEST'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'CONFIRM_RESPOND'; toolCallId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'CLEAR' };

interface ChatState {
  messages: ChatMessage[];
  streaming: boolean;
}

let msgId = 0;
function nextId() {
  return String(++msgId);
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
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
        // After a tool call in debug mode the last message is a TOOL card,
        // not a streaming bubble — start a new agent bubble for the follow-up round.
        msgs.push({ id: nextId(), role: 'agent', content: action.text, streaming: true });
      }
      return { ...state, streaming: true, messages: msgs };
    }

    case 'STREAM_END': {
      const msgs = state.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m));
      return { ...state, streaming: false, messages: msgs };
    }

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

    case 'CLEAR':
      return { messages: [], streaming: false };

    default:
      return state;
  }
}

// ── App ──────────────────────────────────────────────────────────────────────

/** Root application component. Manages tab state and wires WebSocket to chat. */
export function App() {
  const [tab, setTab] = useState<'chat' | 'settings'>('chat');
  const [debugMode, setDebugMode] = useState(false);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('guard');
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [chatState, dispatch] = useReducer(chatReducer, { messages: [], streaming: false });

  const sendRef = useRef<(msg: ClientMessage) => void>(() => {});

  const handleChoiceChange = useCallback((nextProvider: string, nextModel: string) => {
    sendRef.current({ type: 'set_active_choice', provider: nextProvider, model: nextModel });
  }, []);

  const { providers, provider, model, models, setProvider, setModel, initFromLastChoice } =
    useProviders(handleChoiceChange);

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'ready':
          sendMsg({ type: 'get_settings' });
          break;
        case 'stream_start':
          dispatch({ type: 'STREAM_START' });
          break;
        case 'stream_chunk':
          dispatch({ type: 'STREAM_CHUNK', text: msg.text });
          break;
        case 'stream_end':
          dispatch({ type: 'STREAM_END' });
          break;
        case 'tool_start':
          if (debugMode) dispatch({ type: 'TOOL_START', name: msg.name, args: msg.args });
          break;
        case 'confirm_request':
          dispatch({
            type: 'CONFIRM_REQUEST',
            toolCallId: msg.toolCallId,
            toolName: msg.toolName,
            args: msg.args,
          });
          break;
        case 'error':
          dispatch({ type: 'ERROR', message: msg.message });
          break;
        case 'history_cleared':
          dispatch({ type: 'CLEAR' });
          break;
        case 'settings':
          setSettings(msg);
          initFromLastChoice(msg.lastProvider, msg.lastModel);
          break;
        case 'settings_saved':
          break;
        case 'key_cleared':
          setSettings((prev) =>
            prev ? { ...prev, keys: { ...prev.keys, [msg.provider]: null } } : prev,
          );
          break;
        case 'history':
          dispatch({ type: 'LOAD_HISTORY', messages: msg.messages });
          break;
      }
    },
    [debugMode, initFromLastChoice],
  );

  const { send: sendMsg } = useWebSocket(handleMessage);
  sendRef.current = sendMsg;

  function handleSend(text: string) {
    dispatch({ type: 'ADD_USER', text });
    sendMsg({ type: 'chat', text, provider, model });
  }

  function handleSuggestion(text: string) {
    handleSend(text);
  }

  function handleClear() {
    sendMsg({ type: 'clear_history' });
  }

  function handleDiagnose() {
    dispatch({ type: 'STREAM_START' });
    sendMsg({ type: 'debug', provider, model });
  }

  function handleToggleDebug() {
    setDebugMode((d) => !d);
  }

  function handleSetConfirmMode(mode: ConfirmMode) {
    setConfirmMode(mode);
    sendMsg({ type: 'set_confirm_mode', mode });
  }

  function handleConfirm(toolCallId: string, confirmed: boolean) {
    dispatch({ type: 'CONFIRM_RESPOND', toolCallId });
    sendMsg({ type: 'confirm_response', confirmed, toolCallId });
  }

  function handleSaveSettings(payload: { keys: Record<string, string> }) {
    sendMsg({ type: 'save_settings', ...payload });
  }

  function handleClearKey(prov: string) {
    sendMsg({ type: 'clear_key', provider: prov });
  }

  function handleOpenUrl(url: string) {
    sendMsg({ type: 'open_url', url });
  }

  function handleTabChange(t: 'chat' | 'settings') {
    setTab(t);
    if (t === 'settings') {
      setTimeout(() => sendMsg({ type: 'get_settings' }), 50);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3.5 py-2.5">
        <div className="h-[18px] w-[18px] shrink-0 rounded-[3px] bg-accent" />
        <h1 className="flex-1 text-[13px] font-semibold">Live Agent</h1>
        <nav className="flex gap-0.5">
          <button
            className={`cursor-pointer rounded-default border-none px-2 py-1 text-[12px] transition-colors hover:bg-surface2 hover:text-text ${tab === 'chat' ? 'bg-surface2 text-accent' : 'text-text-dim'}`}
            onClick={() => handleTabChange('chat')}
          >
            Chat
          </button>
          <button
            className={`cursor-pointer rounded-default border-none px-2 py-1 text-[12px] transition-colors hover:bg-surface2 hover:text-text ${tab === 'settings' ? 'bg-surface2 text-accent' : 'text-text-dim'}`}
            onClick={() => handleTabChange('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      {tab === 'chat' && (
        <ProviderBar
          providers={providers}
          provider={provider}
          model={model}
          models={models}
          debugMode={debugMode}
          confirmMode={confirmMode}
          onProviderChange={setProvider}
          onModelChange={setModel}
          onToggleDebug={handleToggleDebug}
          onSetConfirmMode={handleSetConfirmMode}
          onDiagnose={handleDiagnose}
          onClear={handleClear}
        />
      )}

      {tab === 'chat' ? (
        <ChatPanel
          messages={chatState.messages}
          streaming={chatState.streaming}
          onSend={handleSend}
          onSuggestion={handleSuggestion}
          onConfirm={handleConfirm}
        />
      ) : (
        <SettingsPanel
          providers={providers}
          settings={settings}
          onSave={handleSaveSettings}
          onClearKey={handleClearKey}
          onOpenUrl={handleOpenUrl}
        />
      )}
    </div>
  );
}
