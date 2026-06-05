import type { ConfirmMode, ProvidersRegistry } from '../../types';

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
    <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-surface px-3.5 py-[7px]">
      <select
        className="cursor-pointer rounded-default border border-border bg-surface2 px-1.5 py-0.5 text-[12px] text-text outline-none focus:outline focus:outline-1 focus:outline-accent"
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
        className="cursor-pointer rounded-default border border-border bg-surface2 px-1.5 py-0.5 text-[12px] text-text outline-none focus:outline focus:outline-1 focus:outline-accent"
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
        className={`cursor-pointer rounded-default border-none px-1.5 py-0.5 text-[11px] transition-colors hover:bg-surface2 hover:text-text ${debugMode ? 'text-accent' : 'text-text-dim'}`}
        onClick={onToggleDebug}
        title="Show tool calls in chat"
      >
        Tools
      </button>

      <div
        className="flex shrink-0 overflow-hidden rounded-default border border-border"
        role="group"
        aria-label="Confirmation mode"
      >
        {CONFIRM_MODES.map(({ value, label, title }, index) => (
          <button
            key={value}
            className={`cursor-pointer border-none px-[7px] py-0.5 text-[11px] transition-colors hover:bg-surface2 hover:text-text ${index > 0 ? 'border-l border-border' : ''} ${confirmMode === value ? 'bg-surface2 text-accent' : 'text-text-dim'}`}
            onClick={() => onSetConfirmMode(value)}
            title={title}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        className="cursor-pointer rounded-default border-none px-1.5 py-0.5 text-[11px] text-text-dim transition-colors hover:bg-surface2 hover:text-text"
        onClick={onDiagnose}
        title="Run environment diagnostics"
      >
        Diagnose
      </button>

      <button
        className="ml-auto cursor-pointer rounded-default border-none px-1.5 py-0.5 text-[11px] text-text-dim transition-colors hover:bg-surface2 hover:text-text"
        onClick={onClear}
        title="Clear conversation"
      >
        Clear
      </button>
    </div>
  );
}
