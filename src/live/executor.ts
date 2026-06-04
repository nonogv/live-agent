import { MidiClip, MidiTrack, type Song } from '@ableton-extensions/sdk';
import type { LiveState } from '../agent/chat.js';

/**
 * Builds the LiveState snapshot injected into the system prompt each turn.
 */
export async function getLiveState(song: Song<'1.0.0'>): Promise<LiveState> {
  const tracks = await Promise.all(
    song.tracks.map(async (t) => ({
      id: t.handle.id.toString(),
      name: t.name,
      type: t instanceof MidiTrack ? 'midi' : 'audio',
      devices: await Promise.all(
        t.devices.map(async (d) => ({
          id: d.handle.id.toString(),
          name: d.name,
          parameters: await Promise.all(
            d.parameters.map(async (p) => ({
              id: p.handle.id.toString(),
              name: p.name,
              value: await p.getValue(),
            })),
          ),
        })),
      ),
      sessionClips: t.clipSlots
        .map((slot, idx) => ({ slot, idx }))
        .filter(({ slot }) => slot.clip !== null)
        .map(({ slot, idx }) => {
          const clip = slot.clip!;
          const isMidi = clip instanceof MidiClip;
          return {
            id: clip.handle.id.toString(),
            name: clip.name,
            slotIndex: idx,
            duration: clip.duration,
            notes: isMidi
              ? clip.notes.map((n) => ({
                  pitch: n.pitch,
                  startTime: n.startTime,
                  duration: n.duration,
                  velocity: n.velocity ?? 100,
                }))
              : undefined,
          };
        }),
    })),
  );
  return { tempo: song.tempo, trackCount: song.tracks.length, tracks };
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
      return await getLiveState(song);

    default:
      throw new Error(`Unknown tool: "${name}". Available custom tools: get_live_state.`);
  }
}
