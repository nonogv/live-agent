import { executeGeneratedTool } from '../live/generated-executor.js';
import { handleToolCall } from '../live/executor.js';
import type { AgentContext } from '../live/agent-context.js';
import { attachLiveSnapshotIfNeeded } from './live-snapshot.js';

/** Structured tool failure returned to the LLM for recovery instead of aborting the turn. */
export interface ToolErrorResult {
  ok: false;
  error: string;
}

/**
 * Converts an unknown thrown value into a structured tool error the LLM can act on.
 */
export function formatToolError(err: unknown): ToolErrorResult {
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: message };
}

/**
 * Runs a generated or custom tool call. SDK and lookup failures become structured
 * `{ ok: false, error }` results so the agent loop can continue and retry.
 */
export async function executeToolWithRecovery(
  ctx: AgentContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const song = ctx.getSong();
  let result: unknown;
  try {
    result = await executeGeneratedTool(song, name, args);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Unknown generated tool:')) {
      try {
        result = await handleToolCall(ctx, name, args);
      } catch (customErr) {
        console.error(`[Live Agent] Tool "${name}" failed:`, customErr);
        result = formatToolError(customErr);
      }
    } else {
      console.error(`[Live Agent] Tool "${name}" failed:`, err);
      result = formatToolError(err);
    }
  }

  return attachLiveSnapshotIfNeeded(song, name, result);
}
