import { useEffect, useRef } from 'react';
import styles from './MessageList.module.scss';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';
import type { ChatMessage } from '../types';

interface MessageListProps {
  messages: ChatMessage[];
  onSuggestion: (text: string) => void;
  onConfirm: (toolCallId: string, confirmed: boolean) => void;
}

/** Scrollable list of chat messages with auto-scroll on new content. */
export function MessageList({ messages, onSuggestion, onConfirm }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={styles.messages}>
      {messages.length === 0 ? (
        <EmptyState onSuggestion={onSuggestion} />
      ) : (
        messages.map((m) => <MessageBubble key={m.id} message={m} onConfirm={onConfirm} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
}
