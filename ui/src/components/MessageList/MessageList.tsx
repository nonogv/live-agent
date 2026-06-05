import { useEffect, useRef } from 'react';
import { MessageBubble } from '../MessageBubble';
import { EmptyState } from '../EmptyState';
import { messageTopMargin } from '../../messageSpacing';
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
    <div className="messages-scroll flex flex-1 flex-col overflow-y-auto px-8 py-6">
      {messages.length === 0 ? (
        <EmptyState onSuggestion={onSuggestion} />
      ) : (
        messages
          .filter((m) => !m.hidden)
          .map((m, index, visible) => (
            <div key={m.id} className={messageTopMargin(index, visible)}>
              <MessageBubble
                message={m}
                onConfirm={onConfirm}
                onToggleToolFold={onToggleToolFold}
              />
            </div>
          ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
