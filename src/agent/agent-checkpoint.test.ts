import { describe, it, expect } from 'vitest';
import { shouldPromptToContinue } from './agent-checkpoint.js';
import { ROUNDS_PER_BATCH, MAX_AGENT_ROUNDS } from './constants.js';

describe('shouldPromptToContinue', () => {
  it('prompts after a full batch when the task is still in progress', () => {
    expect(shouldPromptToContinue(ROUNDS_PER_BATCH, true, ROUNDS_PER_BATCH, MAX_AGENT_ROUNDS)).toBe(
      true,
    );
  });

  it('does not prompt when the model finished without tool calls', () => {
    expect(
      shouldPromptToContinue(ROUNDS_PER_BATCH, false, ROUNDS_PER_BATCH, MAX_AGENT_ROUNDS),
    ).toBe(false);
  });

  it('does not prompt before the batch is complete', () => {
    expect(shouldPromptToContinue(ROUNDS_PER_BATCH - 1, true, 9, MAX_AGENT_ROUNDS)).toBe(false);
  });

  it('does not prompt when the hard round cap is already reached', () => {
    expect(shouldPromptToContinue(ROUNDS_PER_BATCH, true, MAX_AGENT_ROUNDS, MAX_AGENT_ROUNDS)).toBe(
      false,
    );
  });
});
