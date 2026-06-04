import type { ToolSchema } from "../providers/index.js";

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "get_live_state",
    description:
      "Returns the current state of the Live session: tempo, time signature, and all tracks with their names and types.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_tracks",
    description: "Returns a list of all tracks in the session with their id, name, and type.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_midi_track",
    description: "Creates a new MIDI track in the session.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the new track.",
        },
        index: {
          type: "number",
          description: "Position to insert the track (0-based). Appends at end if omitted.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create_audio_track",
    description: "Creates a new Audio track in the session.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the new track.",
        },
        index: {
          type: "number",
          description: "Position to insert the track (0-based). Appends at end if omitted.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "rename_track",
    description: "Renames an existing track by its id.",
    parameters: {
      type: "object",
      properties: {
        track_id: {
          type: "string",
          description: "The id of the track to rename (from get_tracks).",
        },
        name: {
          type: "string",
          description: "The new name for the track.",
        },
      },
      required: ["track_id", "name"],
    },
  },
  {
    name: "delete_track",
    description: "Deletes a track by its id.",
    parameters: {
      type: "object",
      properties: {
        track_id: {
          type: "string",
          description: "The id of the track to delete.",
        },
      },
      required: ["track_id"],
    },
  },
  {
    name: "duplicate_track",
    description: "Duplicates a track by its id.",
    parameters: {
      type: "object",
      properties: {
        track_id: {
          type: "string",
          description: "The id of the track to duplicate.",
        },
      },
      required: ["track_id"],
    },
  },
  {
    name: "set_tempo",
    description: "Sets the session tempo in BPM.",
    parameters: {
      type: "object",
      properties: {
        bpm: {
          type: "number",
          description: "Tempo in BPM (20–999).",
        },
      },
      required: ["bpm"],
    },
  },
  {
    name: "create_midi_clip",
    description: "Creates an empty MIDI clip in a track's clip slot.",
    parameters: {
      type: "object",
      properties: {
        track_id: {
          type: "string",
          description: "The id of the MIDI track to add the clip to.",
        },
        slot_index: {
          type: "number",
          description: "The clip slot index (0-based).",
        },
        length: {
          type: "number",
          description: "Clip length in bars. Defaults to 2.",
        },
        name: {
          type: "string",
          description: "Optional name for the clip.",
        },
      },
      required: ["track_id", "slot_index"],
    },
  },
  {
    name: "rename_clip",
    description: "Renames a clip on a specific track and slot.",
    parameters: {
      type: "object",
      properties: {
        track_id: {
          type: "string",
          description: "The id of the track.",
        },
        slot_index: {
          type: "number",
          description: "The clip slot index.",
        },
        name: {
          type: "string",
          description: "New name for the clip.",
        },
      },
      required: ["track_id", "slot_index", "name"],
    },
  },
  {
    name: "fire_clip",
    description: "Triggers playback of a clip slot.",
    parameters: {
      type: "object",
      properties: {
        track_id: {
          type: "string",
          description: "The id of the track.",
        },
        slot_index: {
          type: "number",
          description: "The clip slot index to fire.",
        },
      },
      required: ["track_id", "slot_index"],
    },
  },
  {
    name: "fire_scene",
    description: "Fires (launches) a scene by index.",
    parameters: {
      type: "object",
      properties: {
        scene_index: {
          type: "number",
          description: "The scene index (0-based).",
        },
      },
      required: ["scene_index"],
    },
  },
];
