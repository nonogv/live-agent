import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, X } from 'lucide-react';
import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onConfirm: (toolCallId: string, confirmed: boolean) => void;
  onToggleToolFold: (id: string) => void;
}

const ICON_BTN =
  'flex cursor-pointer items-center justify-center rounded-default border-none p-1.5 transition-colors hover:bg-surface2';

/** Renders a single chat message with role-appropriate styling. */
export function MessageBubble({ message, onConfirm, onToggleToolFold }: MessageBubbleProps) {
  const { role, content, streaming, toolName, toolArgs, toolCallId, folded } = message;

  if (role === 'confirm' && toolCallId) {
    return (
      <div className="ml-2 font-mono text-[11px] text-text-dim">
        <div className="whitespace-pre-wrap">
          <span className="font-semibold text-[#7ab0d4]">⚠ {toolName}</span>
          <div className="mt-0.5 whitespace-pre-wrap text-text-dim">
            {JSON.stringify(toolArgs, null, 2)}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              className={`${ICON_BTN} text-[#6abf6a]`}
              onClick={() => onConfirm(toolCallId, true)}
              title="Confirm"
            >
              <Check size={14} />
            </button>
            <button
              className={`${ICON_BTN} text-red-400`}
              onClick={() => onConfirm(toolCallId, false)}
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-default bg-[#2a2a2a] px-2.5 py-2 leading-normal break-words">
          <div className="whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    );
  }

  if (role === 'agent') {
    return (
      <div className="leading-normal break-words">
        {streaming ? (
          <div className={`whitespace-pre-wrap${streaming ? ' streaming-cursor' : ''}`}>
            {content}
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  }

  if (role === 'tool') {
    const isFolded = folded ?? false;

    return (
      <button
        type="button"
        className="ml-3 w-full cursor-pointer border-none bg-transparent p-0 text-left font-mono text-[11px] text-[#555]"
        onClick={() => onToggleToolFold(message.id)}
        title={isFolded ? 'Expand tool call' : 'Collapse tool call'}
      >
        <div
          className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${isFolded ? 'max-h-5' : 'max-h-96'}`}
        >
          {isFolded ? (
            <span>▸ {toolName}</span>
          ) : (
            <div className="whitespace-pre-wrap">
              <span className="font-semibold">▾ {toolName}</span>
              <div className="mt-0.5 whitespace-pre-wrap">{JSON.stringify(toolArgs, null, 2)}</div>
            </div>
          )}
        </div>
      </button>
    );
  }

  if (role === 'error') {
    return <div className="text-red-400 leading-normal break-words">{content}</div>;
  }

  return <div className="leading-normal break-words">{content}</div>;
}
