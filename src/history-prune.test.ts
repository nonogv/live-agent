import { describe, it, expect } from 'vitest';
import {
  pruneHistoryForProvider,
  HISTORY_PRUNE_THRESHOLD,
  HISTORY_PRUNE_OMIT_MESSAGE,
} from './history-prune.js';
import type { ProviderMessage } from './providers/index.js';

function toolPair(id: string, round: number): ProviderMessage[] {
  return [
    {
      role: 'assistant',
      content: '',
      toolCall: { id, name: 'get_live_state', args: {} },
    },
    {
      role: 'tool',
      toolCallId: id,
      toolName: 'get_live_state',
      content: `{"round":${round}}`,
    },
  ];
}

describe('pruneHistoryForProvider', () => {
  it('returns the same array reference content when under the threshold', () => {
    const history: ProviderMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    const pruned = pruneHistoryForProvider(history);
    expect(pruned).toEqual(history);
  });

  it('drops oldest assistant+tool pairs and keeps all user messages', () => {
    const history: ProviderMessage[] = [
      { role: 'user', content: 'first question' },
      ...toolPair('call-1', 1),
      { role: 'user', content: 'second question' },
    ];

    for (let i = 0; i < 20; i++) {
      history.push(...toolPair(`newer-${i}`, i));
    }

    expect(history.length).toBeGreaterThan(HISTORY_PRUNE_THRESHOLD);

    const userMessages = history.filter((m) => m.role === 'user');
    const pruned = pruneHistoryForProvider(history);

    for (const user of userMessages) {
      expect(pruned).toContainEqual(user);
    }
    expect(pruned.length).toBeLessThanOrEqual(HISTORY_PRUNE_THRESHOLD + 1);
    expect(pruned.some((m) => m.role === 'tool' && m.toolCallId === 'call-1')).toBe(false);
    expect(pruned.some((m) => m.role === 'tool' && m.toolCallId === 'newer-19')).toBe(true);
  });

  it('inserts a synthetic assistant omission note when pruning occurs', () => {
    const history: ProviderMessage[] = [];
    for (let i = 0; i < 25; i++) {
      history.push({ role: 'user', content: `user-${i}` });
      history.push(...toolPair(`tc-${i}`, i));
    }

    expect(history.length).toBeGreaterThan(HISTORY_PRUNE_THRESHOLD);

    const pruned = pruneHistoryForProvider(history);
    const omitNotes = pruned.filter(
      (m) => m.role === 'assistant' && m.content === HISTORY_PRUNE_OMIT_MESSAGE,
    );
    expect(omitNotes).toHaveLength(1);
  });

  it('never removes plain assistant text responses without tool calls', () => {
    const history: ProviderMessage[] = [
      { role: 'user', content: 'explain this' },
      { role: 'assistant', content: 'Here is a long explanation without tools.' },
    ];

    for (let i = 0; i < 30; i++) {
      history.push(...toolPair(`extra-${i}`, i));
    }

    const pruned = pruneHistoryForProvider(history);
    expect(pruned).toContainEqual({
      role: 'assistant',
      content: 'Here is a long explanation without tools.',
    });
  });
});
