import styles from './ProviderBar.module.scss';
import type { ConfirmMode, ProvidersRegistry } from '../types';

const CONFIRM_MODES: { value: ConfirmMode; label: string; title: string }[] = [
  { value: 'review', label: 'Review', title: 'Ask before every tool call' },
  { value: 'guard', label: 'Guard', title: 'Ask only before destructive operations (default)' },
  { value: 'off', label: 'Auto', title: 'Run all tools without asking' },
];

interface ProviderBarProps {
  providers: ProvidersRegistry;
  provider: string;
  model: string;
  models: { id: string; label: string }[];
  debugMode: boolean;
  confirmMode: ConfirmMode;
  onProviderChange: (p: string) => void;
  onModelChange: (m: string) => void;
  onToggleDebug: () => void;
  onSetConfirmMode: (mode: ConfirmMode) => void;
  onDiagnose: () => void;
  onClear: () => void;
}

/** Model selector bar shown above the chat panel. */
export function ProviderBar({
  providers,
  provider,
  model,
  models,
  debugMode,
  confirmMode,
  onProviderChange,
  onModelChange,
  onToggleDebug,
  onSetConfirmMode,
  onDiagnose,
  onClear,
}: ProviderBarProps) {
  return (
    <div className={styles.modelBar}>
      <select
        className={styles.select}
        value={provider}
        onChange={(e) => onProviderChange(e.target.value)}
      >
        {Object.entries(providers).map(([id, p]) => (
          <option key={id} value={id}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      <button
        className={`${styles.btn}${debugMode ? ` ${styles.active}` : ''}`}
        onClick={onToggleDebug}
        title="Show tool calls in chat"
      >
        Tools
      </button>

      {/* Three-way confirm mode segmented control */}
      <div className={styles.segmented} role="group" aria-label="Confirmation mode">
        {CONFIRM_MODES.map(({ value, label, title }) => (
          <button
            key={value}
            className={`${styles.seg}${confirmMode === value ? ` ${styles.active}` : ''}`}
            onClick={() => onSetConfirmMode(value)}
            title={title}
          >
            {label}
          </button>
        ))}
      </div>

      <button className={styles.btn} onClick={onDiagnose} title="Run environment diagnostics">
        Diagnose
      </button>

      <button
        className={`${styles.btn} ${styles.clearBtn}`}
        onClick={onClear}
        title="Clear conversation"
      >
        Clear
      </button>
    </div>
  );
}
