import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, type LiveState, type TrackInfo } from './chat.js';
import type { ToolSchema } from '../providers/index.js';

const emptyMixer = {
  volume: { id: 'v', value: 0.85 },
  panning: { id: 'p', value: 0 },
  sends: [],
};

const emptyClip = (overrides: Partial<LiveState['tracks'][0]['sessionClips'][0]> = {}) => ({
  id: 'c1',
  name: 'Clip',
  slotIndex: 0,
  startTime: 0,
  endTime: 4,
  duration: 4,
  startMarker: 0,
  endMarker: 4,
  loopStart: 0,
  loopEnd: 4,
  color: 0,
  looping: false,
  muted: false,
  ...overrides,
});

const emptyTrack = (overrides: Partial<TrackInfo> = {}): TrackInfo => ({
  id: '1',
  name: 'Track',
  type: 'midi',
  mute: false,
  solo: false,
  mutedViaSolo: false,
  arm: false,
  groupTrackId: null,
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
  gridQuantization: 6,
  gridIsTriplet: false,
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
                {
                  id: '20',
                  name: 'Volume',
                  value: 0.8,
                  min: 0,
                  max: 1,
                  defaultValue: 0.85,
                  isQuantized: false,
                },
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
            emptyClip({
              id: '55',
              name: 'Bass Loop',
              duration: 16,
              endTime: 16,
              endMarker: 16,
              loopEnd: 16,
              looping: true,
              notes: [{ pitch: 40, startTime: 0, duration: 0.25, velocity: 100 }],
            }),
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
      scenes: [
        { id: 's1', name: 'Verse', tempo: 120, signatureNumerator: 4, signatureDenominator: 4 },
      ],
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
            emptyClip({
              id: '77',
              name: 'Kick Loop',
              looping: true,
              filePath: '/samples/kick.wav',
              warping: true,
              warpMode: 0,
            }),
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
      scenes: [
        { id: 's1', name: 'Intro', tempo: -1, signatureNumerator: 4, signatureDenominator: 4 },
      ],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('-1bpm');
    expect(prompt).toContain('inherits the Song tempo');
  });

  it('lists arrangement clips in the track overview', () => {
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
              startTime: 0,
              endTime: 8,
              duration: 8,
              startMarker: 0,
              endMarker: 8,
              looping: false,
              loopStart: 0,
              loopEnd: 8,
              color: 0,
              muted: false,
            },
            {
              id: 'arr-2',
              name: 'Arrangement Part 2',
              slotIndex: -1,
              startTime: 0,
              endTime: 16,
              duration: 16,
              startMarker: 0,
              endMarker: 16,
              looping: true,
              loopStart: 0,
              loopEnd: 16,
              color: 0,
              muted: false,
            },
          ],
        }),
      ],
    };
    const prompt = buildSystemPrompt(state, minimalTools);
    expect(prompt).toContain('ArrangementClip');
    expect(prompt).toContain('Arrangement Part');
    expect(prompt).toContain('id:"arr-1"');
  });

  describe('prompt context injection', () => {
    const emptyContext = {
      globalInstructions: '',
      projectInstructions: '',
      globalMemories: '',
      projectMemories: '',
    };

    it('appends no extra sections when all context fields are empty', () => {
      const withoutContext = buildSystemPrompt(emptyState, minimalTools);
      const withEmptyContext = buildSystemPrompt(emptyState, minimalTools, emptyContext);
      expect(withEmptyContext).toBe(withoutContext);
      expect(withEmptyContext).not.toContain('## Your instructions');
      expect(withEmptyContext).not.toContain('## Project instructions');
      expect(withEmptyContext).not.toContain('## About you');
      expect(withEmptyContext).not.toContain('## About this project');
    });

    it('appends global instructions when set', () => {
      const prompt = buildSystemPrompt(emptyState, minimalTools, {
        ...emptyContext,
        globalInstructions: 'Always use sidechain compression.',
      });
      expect(prompt).toContain('## Your instructions\nAlways use sidechain compression.');
    });

    it('appends project instructions when set', () => {
      const prompt = buildSystemPrompt(emptyState, minimalTools, {
        ...emptyContext,
        projectInstructions: 'This is a techno track in A minor.',
      });
      expect(prompt).toContain('## Project instructions\nThis is a techno track in A minor.');
    });

    it('appends global memories when set', () => {
      const prompt = buildSystemPrompt(emptyState, minimalTools, {
        ...emptyContext,
        globalMemories: 'User prefers short answers.',
      });
      expect(prompt).toContain('## About you\nUser prefers short answers.');
    });

    it('appends project memories when set', () => {
      const prompt = buildSystemPrompt(emptyState, minimalTools, {
        ...emptyContext,
        projectMemories: 'Kick drum is on track 1.',
      });
      expect(prompt).toContain('## About this project\nKick drum is on track 1.');
    });

    it('treats whitespace-only context fields as empty', () => {
      const prompt = buildSystemPrompt(emptyState, minimalTools, {
        globalInstructions: '  \n\t  ',
        projectInstructions: '   ',
        globalMemories: '\n',
        projectMemories: ' \t ',
      });
      const baseline = buildSystemPrompt(emptyState, minimalTools);
      expect(prompt).toBe(baseline);
    });

    it('appends all four sections in order when all are set', () => {
      const prompt = buildSystemPrompt(emptyState, minimalTools, {
        globalInstructions: 'Global rule',
        projectInstructions: 'Project rule',
        globalMemories: 'Global memory',
        projectMemories: 'Project memory',
      });
      const toolRefIndex = prompt.indexOf('## Full tool reference');
      const globalIdx = prompt.indexOf('## Your instructions\nGlobal rule');
      const projectInstrIdx = prompt.indexOf('## Project instructions\nProject rule');
      const globalMemIdx = prompt.indexOf('## About you\nGlobal memory');
      const projectMemIdx = prompt.indexOf('## About this project\nProject memory');

      expect(globalIdx).toBeGreaterThan(toolRefIndex);
      expect(projectInstrIdx).toBeGreaterThan(globalIdx);
      expect(globalMemIdx).toBeGreaterThan(projectInstrIdx);
      expect(projectMemIdx).toBeGreaterThan(globalMemIdx);
    });
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

  it('instructs the model to recover from tool errors instead of stopping', () => {
    const prompt = buildSystemPrompt(emptyState, minimalTools);
    expect(prompt).toContain('{ ok: false, error: "..." }');
    expect(prompt).toContain('do not stop after a single failure');
  });

  it('documents the last-track constraint and liveSnapshot on layout changes', () => {
    const prompt = buildSystemPrompt(emptyState, minimalTools);
    expect(prompt).toContain('always keeps at least one');
    expect(prompt).toContain('liveSnapshot');
  });

  it('mentions batch continue checkpoints for long tasks', () => {
    const prompt = buildSystemPrompt(emptyState, minimalTools);
    expect(prompt).toContain('pause every ~5 steps');
    expect(prompt).toContain('Auto skips step prompts');
  });

  it('documents web_search, session clips, and completion verification', () => {
    const prompt = buildSystemPrompt(emptyState, minimalTools);
    expect(prompt).toContain('web_search');
    expect(prompt).toContain('clip_slot_create_midi_clip');
    expect(prompt).toContain('Before claiming a task is done');
  });

  it('documents learning and production reference via web_search', () => {
    const prompt = buildSystemPrompt(emptyState, minimalTools);
    expect(prompt).toContain('Learning & reference');
    expect(prompt).toContain('production technique');
    expect(prompt).toContain('source: "docs"');
  });

  it('includes guitar tab tuning and GM drum map', () => {
    const prompt = buildSystemPrompt(emptyState, minimalTools);
    expect(prompt).toContain('guitar tab');
    expect(prompt).toContain('E2=40');
    expect(prompt).toContain('GM drum map');
    expect(prompt).toContain('kick=36');
    expect(prompt).toContain('snare=38');
    expect(prompt).toContain('closed hi-hat=42');
  });
});
