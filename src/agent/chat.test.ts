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
  rootNote: 0,
  scaleName: 'Major',
  scaleMode: false,
  scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
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
    expect(prompt).toContain('id:"42"');
    expect(prompt).toContain('[midi]');
    expect(prompt).toContain('"Room"');
    expect(prompt).toContain('id:"99"');
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

  it('lists devices with name and id (parameters omitted to save tokens)', () => {
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
    expect(prompt).toContain('id:"10"');
    // Individual parameter details are not in the overview (call get_live_state for them)
    expect(prompt).not.toContain('id:"20"');
  });

  it('lists session clip names and shows note count hint instead of raw notes', () => {
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
    expect(prompt).toContain('id:"55"');
    // Notes are not dumped inline; only a count hint is shown
    expect(prompt).toContain('1 notes');
    expect(prompt).not.toContain('p:40');
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

  it('includes song key and scale info', () => {
    const state: LiveState = {
      ...emptyState,
      rootNote: 2,
      scaleName: 'Dorian',
      scaleMode: true,
      scaleIntervals: [0, 2, 3, 5, 7, 9, 10],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('root=2');
    expect(prompt).toContain('"Dorian"');
    expect(prompt).toContain('scaleMode=true');
    expect(prompt).toContain('0, 2, 3, 5, 7, 9, 10');
  });

  it('renders audio clip filename and warp mode', () => {
    const state: LiveState = {
      ...emptyState,
      trackCount: 1,
      tracks: [
        emptyTrack({
          id: '1',
          name: 'Drums',
          type: 'audio',
          sessionClips: [
            {
              id: '77',
              name: 'Kick Loop',
              slotIndex: 0,
              duration: 4,
              looping: true,
              muted: false,
              filePath: '/samples/kick.wav',
              warping: true,
              warpMode: 0,
            },
          ],
        }),
      ],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('kick.wav'); // filename shown (not full path)
    expect(prompt).toContain('warpMode:0');
  });

  it('explains scene tempo -1 inherits song tempo', () => {
    const state: LiveState = {
      ...emptyState,
      scenes: [{ id: 's1', name: 'Intro', tempo: -1 }],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('-1bpm');
    expect(prompt).toContain('inherits the Song tempo');
  });

  it('shows arrangement clip count hint without listing arrangement clips', () => {
    const state: LiveState = {
      ...emptyState,
      trackCount: 1,
      tracks: [
        emptyTrack({
          id: '1',
          name: 'Lead',
          arrangementClips: [
            {
              id: 'arr-1',
              name: 'Arrangement Part',
              slotIndex: -1,
              duration: 8,
              looping: false,
              muted: false,
            },
            {
              id: 'arr-2',
              name: 'Arrangement Part 2',
              slotIndex: -1,
              duration: 16,
              looping: true,
              muted: false,
            },
          ],
        }),
      ],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('2 arrangement clips');
    expect(prompt).not.toContain('Arrangement Part');
    expect(prompt).not.toContain('id:"arr-1"');
  });

  it('omits per-send ids from the mixer overview while keeping send values', () => {
    const state: LiveState = {
      ...emptyState,
      trackCount: 1,
      tracks: [
        emptyTrack({
          id: '1',
          name: 'Vox',
          mixer: {
            volume: { id: 'vol-id', value: 0.75 },
            panning: { id: 'pan-id', value: 0.5 },
            sends: [
              { id: 'send-a-id', value: 0.25 },
              { id: 'send-b-id', value: 0.1 },
            ],
          },
        }),
      ],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('[0]=0.25');
    expect(prompt).toContain('[1]=0.10');
    expect(prompt).not.toContain('send-a-id');
    expect(prompt).not.toContain('send-b-id');
    expect(prompt).toContain('id:"vol-id"');
    expect(prompt).toContain('id:"pan-id"');
  });
});
