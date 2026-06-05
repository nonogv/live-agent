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
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-5 text-center text-text-dim">
      <div className="text-[32px] opacity-40">🎛️</div>
      <p className="max-w-[260px] text-[12px] leading-relaxed">
        Chat with your Ableton session. Try:
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="cursor-pointer rounded-xl border border-border bg-surface2 px-2.5 py-1.5 text-[11px] text-text-dim transition-colors hover:border-accent hover:text-text"
            onClick={() => onSuggestion(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
