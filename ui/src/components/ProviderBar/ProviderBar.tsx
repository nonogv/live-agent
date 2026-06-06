import { Activity, Bug, Code2, MessageSquare, Settings, Trash2 } from 'lucide-react';
import { getPanelToggleMeta, type AppTab } from '../../appTab.js';
import type { ConfirmMode, ProvidersRegistry } from '../../types';

const CONFIRM_MODES: { value: ConfirmMode; label: string; title: string }[] = [
  { value: 'review', label: 'Review', title: 'Ask before every tool call' },
  { value: 'guard', label: 'Guard', title: 'Ask only before destructive operations (default)' },
  { value: 'off', label: 'Auto', title: 'Run all tools and multi-step batches without asking' },
];

const ICON_BTN =
  'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-default border-none p-0 transition-colors hover:bg-surface2 hover:text-text';

interface ProviderBarProps {
  tab: AppTab;
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
  onToggleTab: () => void;
}

/** Bottom control bar: provider/model, chat tools, and chat ↔ settings toggle. */
export function ProviderBar({
  tab,
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
  onToggleTab,
}: ProviderBarProps) {
  const panelToggle = getPanelToggleMeta(tab);
  const ToggleIcon = panelToggle.icon === 'settings' ? Settings : MessageSquare;

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-hidden bg-surface px-3 pt-1.5 pb-4.5">
      {tab === 'chat' && (
        <>
          <select
            className="min-w-0 max-w-[30%] shrink cursor-pointer rounded-default border border-border bg-surface2 px-2 py-1 text-[12px] text-text outline-none focus:outline focus:outline-1 focus:outline-accent"
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
            className="min-w-0 flex-1 shrink cursor-pointer rounded-default border border-border bg-surface2 px-2 py-1 text-[12px] text-text outline-none focus:outline focus:outline-1 focus:outline-accent"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div
            className="flex shrink-0 overflow-hidden rounded-default border border-border"
            role="group"
            aria-label="Confirmation mode"
          >
            {CONFIRM_MODES.map(({ value, label, title }, index) => (
              <button
                key={value}
                className={`cursor-pointer border-none px-2 py-0.5 text-[11px] transition-colors hover:bg-surface2 hover:text-text ${index > 0 ? 'border-l border-border' : ''} ${confirmMode === value ? 'bg-surface2 text-accent' : 'text-text-dim'}`}
                onClick={() => onSetConfirmMode(value)}
                title={title}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {tab === 'chat' && (
          <>
            <button
              className={`${ICON_BTN} ${debugMode ? 'text-accent' : 'text-text-dim'}`}
              onClick={onToggleDebug}
              title="Show tool calls in chat"
            >
              {debugMode ? <Bug size={15} /> : <Code2 size={15} />}
            </button>
            <button
              className={`${ICON_BTN} text-text-dim`}
              onClick={onDiagnose}
              title="Run environment diagnostics"
            >
              <Activity size={15} />
            </button>
            <button
              className={`${ICON_BTN} text-text-dim`}
              onClick={onClear}
              title="Clear conversation"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
        <button
          className={`${ICON_BTN} text-text-dim`}
          onClick={onToggleTab}
          title={panelToggle.title}
          aria-label={panelToggle.title}
        >
          <ToggleIcon size={15} />
        </button>
      </div>
    </div>
  );
}
