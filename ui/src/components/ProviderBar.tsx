import styles from './ProviderBar.module.scss';
import type { ProvidersRegistry } from '../types';

interface ProviderBarProps {
  providers: ProvidersRegistry;
  provider: string;
  model: string;
  models: { id: string; label: string }[];
  debugMode: boolean;
  onProviderChange: (p: string) => void;
  onModelChange: (m: string) => void;
  onToggleDebug: () => void;
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
  onProviderChange,
  onModelChange,
  onToggleDebug,
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
