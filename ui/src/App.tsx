import { useCallback, useReducer, useRef, useState } from 'react';
import { MessageSquare, Settings } from 'lucide-react';
import { ChatPanel } from './components/ChatPanel';
import { ProviderBar } from './components/ProviderBar';
import { SettingsPanel } from './components/SettingsPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useProviders } from './hooks/useProviders';
import { chatReducer } from './chatReducer';
import type { ClientMessage, ConfirmMode, ServerMessage, SettingsPayload } from './types';

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
          dispatch({ type: 'FOLD_TOOL_MESSAGES' });
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

  function handleToggleToolFold(id: string) {
    dispatch({ type: 'TOGGLE_TOOL_FOLD', id });
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

  const tabBtn =
    'flex cursor-pointer items-center justify-center rounded-default border-none p-2 transition-colors hover:bg-surface2';

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-end gap-1 px-4 py-2.5">
        <button
          className={`${tabBtn} ${tab === 'chat' ? 'text-accent' : 'text-text-dim'}`}
          onClick={() => handleTabChange('chat')}
          title="Chat"
        >
          <MessageSquare size={18} />
        </button>
        <button
          className={`${tabBtn} ${tab === 'settings' ? 'text-accent' : 'text-text-dim'}`}
          onClick={() => handleTabChange('settings')}
          title="Settings"
        >
          <Settings size={18} />
        </button>
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
          onToggleToolFold={handleToggleToolFold}
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
