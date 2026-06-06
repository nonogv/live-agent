/** Agent steps (LLM rounds with tool calls) per batch before asking the user to continue. */
export const ROUNDS_PER_BATCH = 5;

/** Absolute max agent steps across all approved batches in one user turn. */
export const MAX_AGENT_ROUNDS = 50;

/** Sentinel tool name for batch-continue approval prompts (reuses confirm UI). */
export const CONTINUE_TASK_TOOL_NAME = 'Continue task';

/** User-visible notice streamed before the continue approval buttons appear. */
export function continueCheckpointMessage(roundsCompleted: number): string {
  return `\n\n---\n**${roundsCompleted} steps completed.** Continue working on this task?`;
}

/** User-visible notice when the user declines a continue prompt. */
export const STOPPED_BY_USER_MESSAGE =
  '\n\n---\n**Stopped** — send another message when you want me to pick up again.';

/** User-visible notice when {@link MAX_AGENT_ROUNDS} is exhausted mid-task. */
export const ROUND_LIMIT_MESSAGE =
  '\n\n---\n**Step limit reached** for this turn. Send another message to continue where I left off.';
