import { useCallback, useReducer, useState } from 'react';
import styles from './App.module.scss';
import { ChatPanel } from './components/ChatPanel';
import { ProviderBar } from './components/ProviderBar';
import { SettingsPanel } from './components/SettingsPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useProviders } from './hooks/useProviders';
import type { ChatMessage, ClientMessage, ServerMessage, SettingsPayload } from './types';

// ── Chat state via useReducer ────────────────────────────────────────────────

type ChatAction =
  | { type: 'ADD_USER'; text: string }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_CHUNK'; text: string }
  | { type: 'STREAM_END' }
  | { type: 'TOOL_START'; name: string; args: unknown }
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
      }
      return { ...state, messages: msgs };
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
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [chatState, dispatch] = useReducer(chatReducer, { messages: [], streaming: false });

  const { providers, provider, model, models, setProvider, setModel } = useProviders();

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
        case 'error':
          dispatch({ type: 'ERROR', message: msg.message });
          break;
        case 'history_cleared':
          dispatch({ type: 'CLEAR' });
          break;
        case 'settings':
          setSettings(msg);
          // Sync provider/model selectors to saved defaults
          setProvider(msg.defaultProvider);
          setModel(msg.defaultModel);
          break;
        case 'settings_saved':
          break;
        case 'key_cleared':
          setSettings((prev) =>
            prev ? { ...prev, keys: { ...prev.keys, [msg.provider]: null } } : prev,
          );
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debugMode],
  );

  const { send: sendMsg } = useWebSocket(handleMessage);

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

  function handleSaveSettings(payload: {
    keys: Record<string, string>;
    defaultProvider: string;
    defaultModel: string;
  }) {
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
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo} />
        <h1 className={styles.title}>Live Agent</h1>
        <nav className={styles.nav}>
          <button
            className={`${styles.navBtn}${tab === 'chat' ? ` ${styles.active}` : ''}`}
            onClick={() => handleTabChange('chat')}
          >
            Chat
          </button>
          <button
            className={`${styles.navBtn}${tab === 'settings' ? ` ${styles.active}` : ''}`}
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
          onProviderChange={setProvider}
          onModelChange={setModel}
          onToggleDebug={handleToggleDebug}
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
