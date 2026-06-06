import { ROUNDS_PER_BATCH } from './constants.js';

/**
 * Whether the agent loop should pause and ask the user to approve another batch.
 * @param roundInBatch - Steps completed in the current approved batch.
 * @param hadToolCall - Whether the latest round ended with tool calls (task still in progress).
 * @param totalRounds - Steps completed across all batches this turn.
 * @param maxRounds - Hard cap for the turn.
 */
export function shouldPromptToContinue(
  roundInBatch: number,
  hadToolCall: boolean,
  totalRounds: number,
  maxRounds: number,
): boolean {
  if (!hadToolCall) return false;
  if (roundInBatch < ROUNDS_PER_BATCH) return false;
  return totalRounds < maxRounds;
}
