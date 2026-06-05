import { useRef, type KeyboardEvent, type FormEvent } from 'react';

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

/** Text input bar with auto-resizing textarea and send button. */
export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function submit() {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.trim();
    if (!text || disabled) return;
    onSend(text);
    el.value = '';
    el.style.height = 'auto';
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function onInput(_e: FormEvent<HTMLTextAreaElement>) {
    autoResize();
  }

  return (
    <div className="flex shrink-0 items-end gap-3 border-t border-border bg-surface px-4 py-3">
      <textarea
        ref={textareaRef}
        className="min-h-10 max-h-[140px] flex-1 resize-none overflow-y-auto rounded-default border border-border bg-surface2 px-3 py-2.5 text-[14px] leading-snug text-text outline-none placeholder:text-text-dim focus:outline focus:outline-1 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        placeholder="Message Live Agent…"
        rows={1}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onInput={onInput}
      />
      <button
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-default border-none bg-accent text-lg text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-border"
        onClick={submit}
        disabled={disabled}
        title="Send"
      >
        ↑
      </button>
    </div>
  );
}
