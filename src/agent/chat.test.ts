import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, type LiveState, type TrackInfo } from './chat.js';
import type { ToolSchema } from '../providers/index.js';

const emptyMixer = {
  volume: { id: 'v', value: 0.85 },
  panning: { id: 'p', value: 0 },
  sends: [],
};

const emptyTrack = (overrides: Partial<TrackInfo> = {}): TrackInfo => ({
  id: '1',
  name: 'Track',
  type: 'midi',
  mute: false,
  solo: false,
  arm: false,
  mixer: emptyMixer,
  devices: [],
  sessionClips: [],
  arrangementClips: [],
  takeLanes: [],
  ...overrides,
});

const emptyState: LiveState = {
  tempo: 120,
  trackCount: 0,
  tracks: [],
  mainTrack: { id: 'main', mixer: emptyMixer },
  scenes: [],
  cuePoints: [],
};

const minimalTools: ToolSchema[] = [
  {
    name: 'get_live_state',
    description: 'Returns the current session state.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'song_create_midi_track',
    description: 'Creates a MIDI track.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'track_set_name',
    description: 'Renames a track.',
    parameters: {
      type: 'object',
      properties: { track_id: { type: 'string' }, value: { type: 'string' } },
      required: ['track_id', 'value'],
    },
  },
];

describe('buildSystemPrompt', () => {
  it('includes the current tempo in BPM', () => {
    expect(buildSystemPrompt({ ...emptyState, tempo: 138 }, minimalTools)).toContain('138 BPM');
    expect(buildSystemPrompt({ ...emptyState, tempo: 90 }, minimalTools)).toContain('90 BPM');
  });

  it("shows '(no tracks yet)' when the session has no tracks", () => {
    expect(buildSystemPrompt(emptyState, minimalTools)).toContain('(no tracks yet)');
  });

  it('includes track count in the header', () => {
    const state: LiveState = {
      ...emptyState,
      trackCount: 3,
      tracks: [
        emptyTrack({ id: '1', name: 'Kick', type: 'audio' }),
        emptyTrack({ id: '2', name: 'Bass', type: 'midi' }),
        emptyTrack({ id: '3', name: 'Chords', type: 'midi' }),
      ],
    };
    expect(buildSystemPrompt(state, minimalTools)).toContain('Tracks (3');
  });

  it('lists each track with its name, id and type', () => {
    const state: LiveState = {
      ...emptyState,
      trackCount: 2,
      tracks: [
        emptyTrack({ id: '42', name: 'Bass', type: 'midi' }),
        emptyTrack({ id: '99', name: 'Room', type: 'audio' }),
      ],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('"Bass"');
    expect(prompt).toContain('id:42');
    expect(prompt).toContain('[midi]');
    expect(prompt).toContain('"Room"');
    expect(prompt).toContain('id:99');
    expect(prompt).toContain('[audio]');
  });

  it('includes all provided tools in the reference section', () => {
    const prompt = buildSystemPrompt(emptyState, minimalTools);
    expect(prompt).toContain('song_create_midi_track');
    expect(prompt).toContain('track_set_name');
    expect(prompt).toContain('get_live_state');
  });

  it("includes the 'create then rename' workflow note", () => {
    const prompt = buildSystemPrompt(emptyState, minimalTools);
    expect(prompt).toContain('track_set_name');
    expect(prompt).toMatch(/creat.*name|name.*after creat/i);
  });

  it('lists device parameters with range info', () => {
    const state: LiveState = {
      ...emptyState,
      trackCount: 1,
      tracks: [
        emptyTrack({
          id: '1',
          name: 'Bass',
          devices: [
            {
              id: '10',
              name: 'Analog',
              parameters: [
                { id: '20', name: 'Volume', value: 0.8, min: 0, max: 1, defaultValue: 0.85 },
              ],
            },
          ],
        }),
      ],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('Analog');
    expect(prompt).toContain('Volume');
    expect(prompt).toContain('id:20');
  });

  it('lists session clip names and MIDI notes', () => {
    const state: LiveState = {
      ...emptyState,
      trackCount: 1,
      tracks: [
        emptyTrack({
          id: '1',
          name: 'Bass',
          sessionClips: [
            {
              id: '55',
              name: 'Bass Loop',
              slotIndex: 0,
              duration: 16,
              looping: true,
              muted: false,
              notes: [{ pitch: 40, startTime: 0, duration: 0.25, velocity: 100 }],
            },
          ],
        }),
      ],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('Bass Loop');
    expect(prompt).toContain('id:55');
    expect(prompt).toContain('p:40');
  });

  it('lists scenes and cue points', () => {
    const state: LiveState = {
      ...emptyState,
      scenes: [{ id: 's1', name: 'Verse', tempo: 120 }],
      cuePoints: [{ id: 'cp1', name: 'Drop', time: 32 }],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('Verse');
    expect(prompt).toContain('Drop');
    expect(prompt).toContain('@32');
  });
});
