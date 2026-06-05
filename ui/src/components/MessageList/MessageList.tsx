import { useEffect, useRef } from 'react';
import { MessageBubble } from '../MessageBubble';
import { EmptyState } from '../EmptyState';
import type { ChatMessage } from '../../types';

interface MessageListProps {
  messages: ChatMessage[];
  onSuggestion: (text: string) => void;
  onConfirm: (toolCallId: string, confirmed: boolean) => void;
  onToggleToolFold: (id: string) => void;
}

/** Scrollable list of chat messages with auto-scroll on new content. */
export function MessageList({
  messages,
  onSuggestion,
  onConfirm,
  onToggleToolFold,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="messages-scroll flex flex-1 flex-col gap-2 overflow-y-auto p-2">
      {messages.length === 0 ? (
        <EmptyState onSuggestion={onSuggestion} />
      ) : (
        messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onConfirm={onConfirm}
            onToggleToolFold={onToggleToolFold}
          />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
