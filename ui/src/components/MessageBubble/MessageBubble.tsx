import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onConfirm: (toolCallId: string, confirmed: boolean) => void;
}

const ROLE_LABELS: Record<string, string> = {
  user: 'You',
  agent: 'Live Agent',
  tool: 'Tool',
  error: 'Error',
  confirm: 'Confirmation required',
};

const BASE = 'rounded-default p-2.5 leading-normal max-w-full break-words';

const ROLE_CLASSES: Record<string, string> = {
  user: `${BASE} bg-surface3 self-end max-w-[85%]`,
  agent: `${BASE} bg-[#1f2a1f] border border-[#2a3d2a]`,
  tool: `${BASE} bg-[#1a1f2a] border border-[#1a2a3d] font-mono text-[11px] text-text-dim`,
  error: `${BASE} bg-[#2a1a1a] border border-[#3d1a1a] text-red-400`,
  confirm: `${BASE} bg-[#1a1f2a] border border-[#3a3a1a] font-mono text-[11px] text-text-dim`,
};

const LABEL_CLASSES: Record<string, string> = {
  user: 'text-accent',
  agent: 'text-[#6abf6a]',
  tool: 'text-[#6a9abf]',
};

/** Renders a single chat message bubble with the appropriate role styling. */
export function MessageBubble({ message, onConfirm }: MessageBubbleProps) {
  const { role, content, streaming, toolName, toolArgs, toolCallId } = message;

  if (role === 'confirm' && toolCallId) {
    return (
      <div className={ROLE_CLASSES.confirm}>
        <div className="label mb-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-60">
          {ROLE_LABELS.confirm}
        </div>
        <div className="whitespace-pre-wrap">
          <span className="font-semibold text-[#7ab0d4]">⚠ {toolName}</span>
          <div className="mt-0.5 text-text-dim whitespace-pre-wrap">
            {JSON.stringify(toolArgs, null, 2)}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              className="cursor-pointer rounded-default border border-[#3a6a3a] bg-[#1e3a1e] px-3 py-1 text-[12px] text-[#6abf6a] transition-colors hover:bg-[#254a25]"
              onClick={() => onConfirm(toolCallId, true)}
            >
              ✓ Confirm
            </button>
            <button
              className="cursor-pointer rounded-default border border-[#6a3a3a] bg-[#3a1e1e] px-3 py-1 text-[12px] text-red-400 transition-colors hover:bg-[#4a2525]"
              onClick={() => onConfirm(toolCallId, false)}
            >
              ✗ Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={ROLE_CLASSES[role] ?? BASE}>
      <div
        className={`label mb-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-60 ${LABEL_CLASSES[role] ?? ''}`}
      >
        {ROLE_LABELS[role] ?? role}
      </div>
      {role === 'tool' ? (
        <div className="whitespace-pre-wrap">
          <span className="font-semibold text-[#7ab0d4]">⚙ {toolName}</span>
          <div className="mt-0.5 text-text-dim whitespace-pre-wrap">
            {JSON.stringify(toolArgs, null, 2)}
          </div>
        </div>
      ) : (
        <div className={`whitespace-pre-wrap${streaming ? ' streaming-cursor' : ''}`}>
          {content}
        </div>
      )}
    </div>
  );
}
