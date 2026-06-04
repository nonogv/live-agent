import styles from './MessageBubble.module.scss';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onConfirm: (toolCallId: string, confirmed: boolean) => void;
}

const ROLE_LABELS: Record<string, string> = {
  user: 'You',
  agent: 'Live Agent',
  tool: 'Tool',
  error: 'Error',
  confirm: 'Confirmation required',
};

/** Renders a single chat message bubble with the appropriate role styling. */
export function MessageBubble({ message, onConfirm }: MessageBubbleProps) {
  const { role, content, streaming, toolName, toolArgs, toolCallId } = message;

  if (role === 'confirm' && toolCallId) {
    return (
      <div className={`${styles.msg} ${styles.confirm}`}>
        <div className={styles.label}>{ROLE_LABELS.confirm}</div>
        <div className={styles.body}>
          <span className={styles.toolName}>⚠ {toolName}</span>
          <div className={styles.toolArgs}>{JSON.stringify(toolArgs, null, 2)}</div>
          <div className={styles.confirmActions}>
            <button className={styles.confirmYes} onClick={() => onConfirm(toolCallId, true)}>
              ✓ Confirm
            </button>
            <button className={styles.confirmNo} onClick={() => onConfirm(toolCallId, false)}>
              ✗ Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

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
