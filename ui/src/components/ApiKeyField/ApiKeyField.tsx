import { useRef } from 'react';

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
    <div className="mb-3 flex items-center gap-2.5">
      <div
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${isSet ? 'bg-[#6abf6a]' : 'bg-border'}`}
      />
      <label className="flex-1 text-[13px]" htmlFor={`key-${providerId}`}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={`key-${providerId}`}
        className="flex-[2] rounded-default border border-border bg-surface2 px-2.5 py-2 text-[13px] text-text outline-none focus:outline focus:outline-1 focus:outline-accent"
        type="password"
        placeholder={isSet ? '••••••••' : placeholder}
        autoComplete="off"
      />
      <button
        className="shrink-0 cursor-pointer rounded-default border border-border px-2 py-1 text-[12px] text-text-dim hover:border-[#e05555] hover:text-[#e05555]"
        onClick={handleClear}
        title="Clear key"
      >
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
