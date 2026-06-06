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

  it('ERROR clears streaming on in-progress messages and stops global streaming', () => {
    const state = {
      messages: [
        { id: '1', role: 'user' as const, content: 'hi' },
        { id: '2', role: 'agent' as const, content: 'partial', streaming: true },
      ],
      streaming: true,
    };

    const next = chatReducer(state, { type: 'ERROR', message: 'Rate limit exceeded' });

    expect(next.streaming).toBe(false);
    expect(next.messages[1].streaming).toBe(false);
    expect(next.messages[2]).toMatchObject({ role: 'error', content: 'Rate limit exceeded' });
  });

  it('SET_TOOL_VISIBILITY toggles hidden on tool messages only', () => {
    const state = {
      messages: [
        { id: '1', role: 'user' as const, content: 'hi' },
        { id: '2', role: 'tool' as const, content: '', toolName: 'foo' },
        { id: '3', role: 'agent' as const, content: 'ok' },
      ],
      streaming: false,
    };

    const hidden = chatReducer(state, { type: 'SET_TOOL_VISIBILITY', visible: false });
    expect(hidden.messages[1].hidden).toBe(true);
    expect(hidden.messages[0].hidden).toBeUndefined();

    const visible = chatReducer(hidden, { type: 'SET_TOOL_VISIBILITY', visible: true });
    expect(visible.messages[1].hidden).toBe(false);
  });

  it('DIAGNOSTIC_START creates a streaming diagnostic message', () => {
    const next = chatReducer({ messages: [], streaming: false }, { type: 'DIAGNOSTIC_START' });

    expect(next.streaming).toBe(true);
    expect(next.messages[0]).toMatchObject({
      role: 'diagnostic',
      content: '',
      streaming: true,
    });
  });

  it('CONFIRM_RESOLVE removes continue prompt on accept', () => {
    const state = {
      messages: [
        {
          id: 'agent-1',
          role: 'agent' as const,
          content: 'Working…\n\n---\n**5 steps completed.** Continue working on this task?',
        },
        {
          id: 'confirm-1',
          role: 'confirm' as const,
          content: '',
          toolName: 'Continue task',
          toolArgs: { roundsCompleted: 5 },
          toolCallId: 'continue-1',
        },
      ],
      streaming: true,
    };

    const next = chatReducer(state, {
      type: 'CONFIRM_RESOLVE',
      toolCallId: 'continue-1',
      confirmed: true,
    });

    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.content).toBe('Working…');
  });

  it('CONFIRM_RESOLVE keeps continue prompt with declined icon on reject', () => {
    const state = {
      messages: [
        {
          id: 'confirm-1',
          role: 'confirm' as const,
          content: '',
          toolName: 'Continue task',
          toolArgs: { roundsCompleted: 5 },
          toolCallId: 'continue-1',
        },
      ],
      streaming: true,
    };

    const next = chatReducer(state, {
      type: 'CONFIRM_RESOLVE',
      toolCallId: 'continue-1',
      confirmed: false,
    });

    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.confirmOutcome).toBe('declined');
  });

  it('TOOL_START freezes the streaming cursor on the preceding agent bubble', () => {
    const state = {
      messages: [{ id: '1', role: 'agent' as const, content: 'thinking…', streaming: true }],
      streaming: true,
    };

    const next = chatReducer(state, { type: 'TOOL_START', name: 'get_live_state', args: {} });

    expect(next.messages[0]?.streaming).toBe(false);
    expect(next.messages[1]?.role).toBe('tool');
    expect(next.messages[1]?.toolName).toBe('get_live_state');
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
