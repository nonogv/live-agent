import { MidiTrack, type Song } from "@ableton-extensions/sdk";
import type { LiveState } from "../agent/chat.js";

export function getLiveState(song: Song<"1.0.0">): LiveState {
  return {
    tempo: song.tempo,
    trackCount: song.tracks.length,
    tracks: song.tracks.map((t) => ({
      id: t.handle.id.toString(),
      name: t.name,
      type: t instanceof MidiTrack ? "midi" : "audio",
    })),
  };
}

export async function handleToolCall(
  song: Song<"1.0.0">,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_live_state":
      return getLiveState(song);

    case "get_tracks":
      return song.tracks.map((t) => ({
        id: t.handle.id.toString(),
        name: t.name,
        type: t instanceof MidiTrack ? "midi" : "audio",
      }));

    case "create_midi_track": {
      const track = await song.createMidiTrack();
      track.name = args.name as string;
      return { id: track.handle.id.toString(), name: track.name, type: "midi" };
    }

    case "create_audio_track": {
      const track = await song.createAudioTrack();
      track.name = args.name as string;
      return { id: track.handle.id.toString(), name: track.name, type: "audio" };
    }

    case "rename_track": {
      const track = requireTrack(song, args.track_id as string);
      track.name = args.name as string;
      return { id: args.track_id, name: args.name };
    }

    case "delete_track": {
      const track = requireTrack(song, args.track_id as string);
      await song.deleteTrack(track);
      return { deleted: true, id: args.track_id };
    }

    case "duplicate_track": {
      const track = requireTrack(song, args.track_id as string);
      const copy = await song.duplicateTrack(track);
      return { id: copy.handle.id.toString(), name: copy.name };
    }

    case "set_tempo": {
      const bpm = args.bpm as number;
      if (bpm < 20 || bpm > 999) throw new Error("Tempo must be between 20 and 999 BPM.");
      song.tempo = bpm;
      return { tempo: bpm };
    }

    case "create_midi_clip": {
      const track = requireTrack(song, args.track_id as string);
      if (!(track instanceof MidiTrack)) {
        throw new Error("create_midi_clip requires a MIDI track.");
      }
      const slotIndex = args.slot_index as number;
      const length = (args.length as number | undefined) ?? 4;
      const slot = track.clipSlots[slotIndex];
      if (!slot) throw new Error(`Clip slot ${slotIndex} not found on track.`);
      const clip = await slot.createMidiClip(length);
      if (args.name) clip.name = args.name as string;
      return { id: clip.handle.id.toString(), name: clip.name };
    }

    case "rename_clip": {
      const track = requireTrack(song, args.track_id as string);
      const slot = track.clipSlots[args.slot_index as number];
      if (!slot?.clip) throw new Error(`No clip in slot ${args.slot_index}.`);
      slot.clip.name = args.name as string;
      return { name: args.name };
    }

    case "fire_scene": {
      // The SDK doesn't expose scene firing directly — log what we'd do
      const sceneIndex = args.scene_index as number;
      const scene = song.scenes[sceneIndex];
      if (!scene) throw new Error(`Scene ${sceneIndex} not found.`);
      // scene.fire() is not in the beta API — return info for now
      return { note: `Scene "${scene.name}" identified. Scene launching is not yet available in SDK beta.` };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function requireTrack(song: Song<"1.0.0">, trackId: string) {
  const track = song.tracks.find((t) => t.handle.id.toString() === trackId);
  if (!track) throw new Error(`Track with id "${trackId}" not found. Call get_tracks to refresh.`);
  return track;
}
