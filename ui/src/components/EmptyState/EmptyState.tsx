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
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-text-dim">
      <div className="text-[36px] opacity-40">🎛️</div>
      <p className="max-w-[280px] text-[14px] leading-relaxed">
        Chat with your Ableton session. Try:
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="cursor-pointer rounded-xl border border-border bg-surface2 px-3 py-2 text-[13px] text-text-dim transition-colors hover:border-accent hover:text-text"
            onClick={() => onSuggestion(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
