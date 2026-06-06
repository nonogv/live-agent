import { MessageList } from '../MessageList';
import { ChatInput } from '../ChatInput';
import type { ChatMessage } from '../../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  streaming: boolean;
  onSend: (text: string) => void;
  onSuggestion: (text: string) => void;
  onConfirm: (toolCallId: string, confirmed: boolean) => void;
  onToggleToolFold: (id: string) => void;
  onOpenHistory: () => void;
}

/** Full chat panel: message list + input bar. */
export function ChatPanel({
  messages,
  streaming,
  onSend,
  onSuggestion,
  onConfirm,
  onToggleToolFold,
  onOpenHistory,
}: ChatPanelProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList
        messages={messages}
        onSuggestion={onSuggestion}
        onConfirm={onConfirm}
        onToggleToolFold={onToggleToolFold}
      />
      <ChatInput disabled={streaming} onSend={onSend} onOpenHistory={onOpenHistory} />
    </div>
  );
}
