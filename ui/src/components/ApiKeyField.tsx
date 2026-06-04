import { useRef } from 'react';
import styles from './ApiKeyField.module.scss';

interface ApiKeyFieldProps {
  /** Provider id, e.g. "openai". */
  providerId: string;
  label: string;
  placeholder: string;
  /** Whether a key is currently stored for this provider. */
  isSet: boolean;
  onClear: (providerId: string) => void;
}

/** A single API key row: status dot, label, password input, clear button. */
export function ApiKeyField({ providerId, label, placeholder, isSet, onClear }: ApiKeyFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClear() {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClear(providerId);
  }

  return (
    <div className={styles.row}>
      <div className={`${styles.dot} ${isSet ? styles.set : styles.unset}`} />
      <label className={styles.label} htmlFor={`key-${providerId}`}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={`key-${providerId}`}
        className={styles.input}
        type="password"
        placeholder={isSet ? '••••••••' : placeholder}
        autoComplete="off"
      />
      <button className={styles.clearBtn} onClick={handleClear} title="Clear key">
        ✕
      </button>
    </div>
  );
}

/** Returns the current value from the input for a given provider id. */
export function getKeyInputValue(providerId: string): string {
  const el = document.getElementById(`key-${providerId}`) as HTMLInputElement | null;
  return el?.value ?? '';
}
