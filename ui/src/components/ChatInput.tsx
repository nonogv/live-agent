import { useRef, type KeyboardEvent, type FormEvent } from 'react';
import styles from './ChatInput.module.scss';

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
    <div className={styles.inputBar}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        placeholder="Message Live Agent…"
        rows={1}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onInput={onInput}
      />
      <button className={styles.sendBtn} onClick={submit} disabled={disabled} title="Send">
        ↑
      </button>
    </div>
  );
}
