import styles from './EmptyState.module.scss';

const SUGGESTIONS = [
  'Create a MIDI track named Bass',
  'What tracks do I have?',
  'Set tempo to 128 BPM',
  'Duplicate the first track',
];

interface EmptyStateProps {
  onSuggestion: (text: string) => void;
}

/** Placeholder shown when the chat history is empty. */
export function EmptyState({ onSuggestion }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.icon}>🎛️</div>
      <p className={styles.hint}>Chat with your Ableton session. Try:</p>
      <div className={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <button key={s} className={styles.chip} onClick={() => onSuggestion(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
