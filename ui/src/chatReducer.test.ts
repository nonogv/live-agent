import { describe, it, expect, beforeEach } from 'vitest';
import { chatReducer, resetChatMessageIds } from './chatReducer.js';

describe('chatReducer', () => {
  beforeEach(() => {
    resetChatMessageIds();
  });

  it('FOLD_TOOL_MESSAGES marks all tool messages as folded', () => {
    const state = {
      messages: [
        { id: '1', role: 'user' as const, content: 'hi' },
        { id: '2', role: 'tool' as const, content: '', toolName: 'create_track' },
        { id: '3', role: 'agent' as const, content: 'done' },
        { id: '4', role: 'tool' as const, content: '', toolName: 'list_tracks' },
      ],
      streaming: false,
    };

    const next = chatReducer(state, { type: 'FOLD_TOOL_MESSAGES' });

    expect(next.messages[1].folded).toBe(true);
    expect(next.messages[3].folded).toBe(true);
    expect(next.messages[0].folded).toBeUndefined();
    expect(next.messages[2].folded).toBeUndefined();
  });

  it('TOGGLE_TOOL_FOLD flips folded on a single tool message', () => {
    const state = {
      messages: [
        {
          id: 'tool-1',
          role: 'tool' as const,
          content: '',
          toolName: 'create_track',
          folded: true,
        },
      ],
      streaming: false,
    };

    const expanded = chatReducer(state, { type: 'TOGGLE_TOOL_FOLD', id: 'tool-1' });
    expect(expanded.messages[0].folded).toBe(false);

    const folded = chatReducer(expanded, { type: 'TOGGLE_TOOL_FOLD', id: 'tool-1' });
    expect(folded.messages[0].folded).toBe(true);
  });

  it('STREAM_END clears streaming flag without folding tools', () => {
    const state = {
      messages: [
        { id: '1', role: 'agent' as const, content: 'hello', streaming: true },
        { id: '2', role: 'tool' as const, content: '', toolName: 'foo' },
      ],
      streaming: true,
    };

    const next = chatReducer(state, { type: 'STREAM_END' });

    expect(next.streaming).toBe(false);
    expect(next.messages[0].streaming).toBe(false);
    expect(next.messages[1].folded).toBeUndefined();
  });
});
