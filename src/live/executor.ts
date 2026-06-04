import { MidiTrack, type Song } from '@ableton-extensions/sdk';
import type { LiveState } from '../agent/chat.js';

/**
 * Builds the LiveState snapshot injected into the system prompt each turn.
 */
export function getLiveState(song: Song<'1.0.0'>): LiveState {
  return {
    tempo: song.tempo,
    trackCount: song.tracks.length,
    tracks: song.tracks.map((t) => ({
      id: t.handle.id.toString(),
      name: t.name,
      type: t instanceof MidiTrack ? 'midi' : 'audio',
    })),
  };
}

/**
 * Handles custom tools that don't map 1:1 to a generated SDK call.
 * The generated executor handles everything else (see generated-executor.ts).
 */
export async function handleToolCall(
  song: Song<'1.0.0'>,
  name: string,
  _args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'get_live_state':
      return getLiveState(song);

    default:
      throw new Error(`Unknown tool: "${name}". Available custom tools: get_live_state.`);
  }
}
