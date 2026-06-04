import styles from './MessageBubble.module.scss';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

const ROLE_LABELS: Record<string, string> = {
  user: 'You',
  agent: 'Live Agent',
  tool: 'Tool',
  error: 'Error',
};

/** Renders a single chat message bubble with the appropriate role styling. */
export function MessageBubble({ message }: MessageBubbleProps) {
  const { role, content, streaming, toolName, toolArgs } = message;

  return (
    <div className={`${styles.msg} ${styles[role]}`}>
      <div className={styles.label}>{ROLE_LABELS[role] ?? role}</div>
      {role === 'tool' ? (
        <div className={styles.body}>
          <span className={styles.toolName}>⚙ {toolName}</span>
          <div className={styles.toolArgs}>{JSON.stringify(toolArgs, null, 2)}</div>
        </div>
      ) : (
        <div className={`${styles.body}${streaming ? ` ${styles.streaming}` : ''}`}>{content}</div>
      )}
    </div>
  );
}
