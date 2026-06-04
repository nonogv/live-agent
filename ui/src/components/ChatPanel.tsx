import styles from './ChatPanel.module.scss';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  streaming: boolean;
  onSend: (text: string) => void;
  onSuggestion: (text: string) => void;
}

/** Full chat panel: message list + input bar. */
export function ChatPanel({ messages, streaming, onSend, onSuggestion }: ChatPanelProps) {
  return (
    <div className={styles.panel}>
      <MessageList messages={messages} onSuggestion={onSuggestion} />
      <ChatInput disabled={streaming} onSend={onSend} />
    </div>
  );
}
