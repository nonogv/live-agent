import { describe, it, expect } from "vitest";
import { buildSystemPrompt, type LiveState } from "./chat.js";

const emptyState: LiveState = { tempo: 120, trackCount: 0, tracks: [] };

describe("buildSystemPrompt", () => {
  it("includes the current tempo in BPM", () => {
    expect(buildSystemPrompt({ ...emptyState, tempo: 138 })).toContain("138 BPM");
    expect(buildSystemPrompt({ ...emptyState, tempo: 90 })).toContain("90 BPM");
  });

  it("shows '(no tracks yet)' when the session has no tracks", () => {
    expect(buildSystemPrompt(emptyState)).toContain("(no tracks yet)");
  });

  it("includes track count in the header", () => {
    const state: LiveState = {
      tempo: 120,
      trackCount: 3,
      tracks: [
        { id: "1", name: "Kick", type: "audio" },
        { id: "2", name: "Bass", type: "midi" },
        { id: "3", name: "Chords", type: "midi" },
      ],
    };
    expect(buildSystemPrompt(state)).toContain("Tracks (3)");
  });

  it("lists each track with its name, id and type", () => {
    const state: LiveState = {
      tempo: 120,
      trackCount: 2,
      tracks: [
        { id: "42", name: "Bass", type: "midi" },
        { id: "99", name: "Room", type: "audio" },
      ],
    };
    const prompt = buildSystemPrompt(state);
    expect(prompt).toContain('"Bass"');
    expect(prompt).toContain("id: 42");
    expect(prompt).toContain("[midi]");
    expect(prompt).toContain('"Room"');
    expect(prompt).toContain("id: 99");
    expect(prompt).toContain("[audio]");
  });

  it("includes the generated tool naming convention", () => {
    const prompt = buildSystemPrompt(emptyState);
    expect(prompt).toContain("song_create_midi_track");
    expect(prompt).toContain("track_set_name");
    expect(prompt).toContain("get_live_state");
  });

  it("includes the 'create then rename' workflow note", () => {
    const prompt = buildSystemPrompt(emptyState);
    expect(prompt).toContain("track_set_name");
    // The prompt warns to call track_set_name after creating a track
    expect(prompt).toMatch(/creat.*name|name.*after creat/i);
  });
});
