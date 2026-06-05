import type { ProviderMessage } from './providers/index.js';

/** History length above which oldest tool pairs are dropped before each provider call. */
export const HISTORY_PRUNE_THRESHOLD = 40;

/** Synthetic assistant note inserted once when tool-call history is trimmed. */
export const HISTORY_PRUNE_OMIT_MESSAGE =
  '[Earlier tool calls omitted to save context. Call get_live_state to refresh session state.]';

/**
 * Returns a copy of `history` with the oldest assistant+tool pairs removed when
 * length exceeds {@link HISTORY_PRUNE_THRESHOLD}. All user messages are kept.
 * When any pairs are dropped, a synthetic assistant omission note is inserted
 * at the first pruned position.
 */
export function pruneHistoryForProvider(history: ProviderMessage[]): ProviderMessage[] {
  if (history.length <= HISTORY_PRUNE_THRESHOLD) {
    return history;
  }

  const working = [...history];
  let pruned = false;
  let firstPrunedIndex: number | undefined;

  while (working.length > HISTORY_PRUNE_THRESHOLD) {
    const pairIndex = findOldestToolPairIndex(working);
    if (pairIndex === -1) {
      break;
    }
    if (firstPrunedIndex === undefined) {
      firstPrunedIndex = pairIndex;
    }
    working.splice(pairIndex, 2);
    pruned = true;
  }

  if (!pruned || firstPrunedIndex === undefined) {
    return working;
  }

  working.splice(firstPrunedIndex, 0, {
    role: 'assistant',
    content: HISTORY_PRUNE_OMIT_MESSAGE,
  });

  return working;
}

/**
 * Finds the index of the oldest consecutive assistant (with tool call) + tool pair.
 * Returns -1 when no removable pair exists.
 */
function findOldestToolPairIndex(messages: ProviderMessage[]): number {
  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i];
    const next = messages[i + 1];
    if (
      current?.role === 'assistant' &&
      current.toolCall !== undefined &&
      next?.role === 'tool' &&
      next.toolCallId === current.toolCall.id
    ) {
      return i;
    }
  }
  return -1;
}
