import styles from './ChatPanel.module.scss';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  streaming: boolean;
  onSend: (text: string) => void;
  onSuggestion: (text: string) => void;
  onConfirm: (toolCallId: string, confirmed: boolean) => void;
}

/** Full chat panel: message list + input bar. */
export function ChatPanel({
  messages,
  streaming,
  onSend,
  onSuggestion,
  onConfirm,
}: ChatPanelProps) {
  return (
    <div className={styles.panel}>
      <MessageList messages={messages} onSuggestion={onSuggestion} onConfirm={onConfirm} />
      <ChatInput disabled={streaming} onSend={onSend} />
    </div>
  );
}
