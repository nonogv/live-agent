import type { LiveContext, MidiTrack } from "@ableton/live";
import type { LiveState } from "../agent/chat.js";

export async function getLiveState(ctx: LiveContext): Promise<LiveState> {
  const { song } = ctx;
  return {
    tempo: song.tempo,
    timeSignature: `${song.timeSignatureNumerator}/${song.timeSignatureDenominator}`,
    trackCount: song.tracks.length,
    tracks: song.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
    })),
  };
}

export async function handleToolCall(
  ctx: LiveContext,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { song } = ctx;

  switch (name) {
    case "get_live_state":
      return getLiveState(ctx);

    case "get_tracks":
      return song.tracks.map((t) => ({ id: t.id, name: t.name, type: t.type }));

    case "create_midi_track": {
      const track = await song.createMidiTrack({
        name: args.name as string,
        index: args.index as number | undefined,
      });
      return { id: track.id, name: track.name, type: "midi" };
    }

    case "create_audio_track": {
      const track = await song.createAudioTrack({
        name: args.name as string,
        index: args.index as number | undefined,
      });
      return { id: track.id, name: track.name, type: "audio" };
    }

    case "rename_track": {
      const track = requireTrack(ctx, args.track_id as string);
      await track.setName(args.name as string);
      return { id: track.id, name: args.name };
    }

    case "delete_track": {
      const track = requireTrack(ctx, args.track_id as string);
      await track.delete();
      return { deleted: true, id: args.track_id };
    }

    case "duplicate_track": {
      const track = requireTrack(ctx, args.track_id as string);
      const copy = await track.duplicate();
      return { id: copy.id, name: copy.name };
    }

    case "set_tempo": {
      const bpm = args.bpm as number;
      if (bpm < 20 || bpm > 999) throw new Error("Tempo must be between 20 and 999 BPM.");
      // The Live SDK exposes tempo as a readable property; setting it depends on the API surface.
      // This will be finalized once the real SDK is installed.
      // @ts-expect-error — setTempo may be on song once real types are available
      await song.setTempo?.(bpm);
      return { tempo: bpm };
    }

    case "create_midi_clip": {
      const track = requireTrack(ctx, args.track_id as string);
      if (track.type !== "midi") throw new Error("create_midi_clip requires a MIDI track.");
      const midiTrack = track as MidiTrack;
      const clip = await midiTrack.createClip({
        slotIndex: args.slot_index as number,
        length: (args.length as number | undefined) ?? 2,
      });
      if (args.name) await clip.setName(args.name as string);
      return { id: clip.id, name: clip.name };
    }

    case "rename_clip": {
      const track = requireTrack(ctx, args.track_id as string);
      const slot = track.clipSlots[args.slot_index as number];
      if (!slot?.clip) throw new Error(`No clip in slot ${args.slot_index}.`);
      await slot.clip.setName(args.name as string);
      return { name: args.name };
    }

    case "fire_clip": {
      const track = requireTrack(ctx, args.track_id as string);
      const slot = track.clipSlots[args.slot_index as number];
      if (!slot) throw new Error(`Slot ${args.slot_index} not found.`);
      await slot.fire();
      return { fired: true };
    }

    case "fire_scene": {
      const scene = song.scenes[args.scene_index as number];
      if (!scene) throw new Error(`Scene ${args.scene_index} not found.`);
      await scene.fire();
      return { fired: true, scene: scene.name };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function requireTrack(ctx: LiveContext, trackId: string) {
  const track = ctx.song.tracks.find((t) => t.id === trackId);
  if (!track) throw new Error(`Track "${trackId}" not found.`);
  return track;
}
