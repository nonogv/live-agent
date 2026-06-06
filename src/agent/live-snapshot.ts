import type { Song } from '@ableton-extensions/sdk';
import { getLiveState } from '../live/executor.js';
import type { ToolErrorResult } from './tool-execution.js';

/** Compact session view attached to tool results so the LLM gets fresh track ids. */
export interface CompactLiveSnapshot {
  tempo: number;
  tracks: Array<{ id: string; name: string; type: string }>;
}

/** Tools that add, remove, or reorder tracks — ids in the system prompt go stale after these. */
export const TRACK_LAYOUT_TOOLS = new Set([
  'song_delete_track',
  'song_create_midi_track',
  'song_create_audio_track',
  'song_duplicate_track',
]);

/**
 * Builds a compact track list the LLM can use without calling `get_live_state`.
 */
export async function buildCompactSnapshot(song: Song<'1.0.0'>): Promise<CompactLiveSnapshot> {
  const state = await getLiveState(song);
  return {
    tempo: state.tempo,
    tracks: state.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      type: track.type,
    })),
  };
}

function isToolError(result: unknown): result is ToolErrorResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'ok' in result &&
    (result as ToolErrorResult).ok === false &&
    'error' in result
  );
}

/**
 * Adds Live-specific hints to common SDK delete failures.
 */
export function enrichToolErrorMessage(error: string): string {
  if (error === 'Failed to delete track') {
    return `${error}. Live keeps at least one track in the set — mute/clear devices on the last one or repurpose it instead of deleting.`;
  }
  return error;
}

function shouldAttachSnapshot(toolName: string, result: unknown): boolean {
  if (TRACK_LAYOUT_TOOLS.has(toolName)) return true;
  if (!isToolError(result)) return false;
  const error = result.error;
  return error.includes('not found') || error === 'Failed to delete track';
}

/**
 * Merges a fresh track snapshot into a tool result when ids may have changed.
 */
export async function attachLiveSnapshotIfNeeded(
  song: Song<'1.0.0'>,
  toolName: string,
  result: unknown,
): Promise<unknown> {
  const normalized = isToolError(result)
    ? { ...result, error: enrichToolErrorMessage(result.error) }
    : result;

  if (!shouldAttachSnapshot(toolName, normalized)) {
    return normalized;
  }

  const liveSnapshot = await buildCompactSnapshot(song);
  return {
    ...(typeof normalized === 'object' && normalized !== null ? normalized : { value: normalized }),
    liveSnapshot,
  };
}
