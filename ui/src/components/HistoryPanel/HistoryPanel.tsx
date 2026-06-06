import { useState } from 'react';
import { X, Pencil, Check } from 'lucide-react';
import type { SessionMeta } from '../../types';

interface HistoryPanelProps {
  sessions: SessionMeta[];
  currentSessionId: string;
  onLoad: (id: string) => void;
  onName: (name: string) => void;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Overlay panel listing saved conversation sessions with load and rename actions. */
export function HistoryPanel({
  sessions,
  currentSessionId,
  onLoad,
  onName,
  onClose,
}: HistoryPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function startEdit(session: SessionMeta) {
    setEditingId(session.id);
    setEditValue(session.name ?? '');
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      onName(editValue.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-8 py-6 pb-4">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-dim">
          Conversation History
        </h2>
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-default border-none bg-transparent p-0 text-text-dim transition-colors hover:bg-surface2 hover:text-text"
          onClick={onClose}
          aria-label="Close history"
        >
          <X size={16} />
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="px-8 text-[13px] text-text-dim">
          No saved conversations yet. Start chatting and your sessions will appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto px-8 pb-6">
          {sessions.map((session) => {
            const isCurrent = session.id === currentSessionId;
            const isEditing = editingId === session.id;

            return (
              <li
                key={session.id}
                className="group flex items-center gap-2 rounded-default border border-border bg-surface2 px-3 py-2.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                  onClick={() => !isCurrent && onLoad(session.id)}
                  disabled={isCurrent}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-text-dim">
                      {formatDate(session.startedAt)}
                    </span>
                    {isCurrent && (
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        current
                      </span>
                    )}
                  </div>
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      className="mt-0.5 w-full rounded border border-accent bg-surface px-1.5 py-0.5 text-[13px] text-text outline-none"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p className="mt-0.5 truncate text-[13px] text-text">
                      {session.name ?? session.preview ?? 'Unnamed session'}
                    </p>
                  )}
                </button>

                {isEditing ? (
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded border-none bg-transparent p-1 text-accent"
                    onClick={commitEdit}
                    title="Save name"
                  >
                    <Check size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded border-none bg-transparent p-1 text-text-dim opacity-0 transition-opacity group-hover:opacity-100 hover:text-text"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(session);
                    }}
                    title="Rename"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
