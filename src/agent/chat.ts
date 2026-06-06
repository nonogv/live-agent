import type { ToolSchema } from '../providers/index.js';

// ─── Live state types ─────────────────────────────────────────────────────────

export interface NoteInfo {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
}

export interface WarpMarkerInfo {
  sampleTime: number;
  beatTime: number;
}

export interface ClipInfo {
  id: string;
  name: string;
  slotIndex: number; // -1 for arrangement clips
  startTime: number;
  endTime: number;
  duration: number;
  startMarker: number;
  endMarker: number;
  looping: boolean;
  loopStart: number;
  loopEnd: number;
  color: number;
  muted: boolean;
  /** Absolute path to the audio file (AudioClip only). */
  filePath?: string;
  /** Whether warping is enabled (AudioClip only). */
  warping?: boolean;
  /** WarpMode enum value: 0=Beats, 1=Tones, 2=Texture, 3=Re-Pitch, 4=Complex, 6=ComplexPro (AudioClip only). */
  warpMode?: number;
  /** Warp markers (AudioClip only). */
  warpMarkers?: WarpMarkerInfo[];
  notes?: NoteInfo[];
}

export interface DeviceInfo {
  id: string;
  name: string;
  samplePath?: string | null;
  parameters: Array<{
    id: string;
    name: string;
    value: number;
    min: number;
    max: number;
    defaultValue: number;
    isQuantized: boolean;
    valueItems?: Array<{ name: string; shortName: string }>;
  }>;
  chains?: Array<{
    id: string;
    name: string;
    /** MIDI note number for Drum Rack chains (DrumChain only). */
    receivingNote?: number;
    devices: DeviceInfo[];
  }>;
}

export interface MixerInfo {
  volume: { id: string; value: number };
  panning: { id: string; value: number };
  sends: Array<{ id: string; value: number }>;
}

export interface TakeLaneInfo {
  id: string;
  name: string;
  clips: Array<{ id: string; name: string; duration: number }>;
}

export interface TrackInfo {
  id: string;
  name: string;
  type: 'midi' | 'audio' | 'return';
  mute: boolean;
  solo: boolean;
  mutedViaSolo: boolean;
  arm: boolean;
  /** Handle id of the parent group track, if any. */
  groupTrackId: string | null;
  mixer: MixerInfo;
  devices: DeviceInfo[];
  sessionClips: ClipInfo[];
  arrangementClips: ClipInfo[];
  takeLanes: TakeLaneInfo[];
}

export interface LiveState {
  tempo: number;
  /** Root note of the current scale as a MIDI pitch class (0=C … 11=B). */
  rootNote: number;
  /** Name of the scale selected in Live (e.g. "Major", "Minor"). */
  scaleName: string;
  /** Whether Live's Scale Mode is enabled. */
  scaleMode: boolean;
  /** Semitone intervals of the current scale relative to rootNote. */
  scaleIntervals: number[];
  /** GridQuantization enum value (0=NoGrid … 9=ThirtySecond). */
  gridQuantization: number;
  /** Whether the arrangement grid uses triplet subdivisions. */
  gridIsTriplet: boolean;
  trackCount: number;
  tracks: TrackInfo[];
  mainTrack: { id: string; mixer: MixerInfo };
  scenes: Array<{
    id: string;
    name: string;
    tempo: number;
    signatureNumerator: number;
    signatureDenominator: number;
  }>;
  cuePoints: Array<{ id: string; name: string; time: number }>;
}

// ─── System prompt ────────────────────────────────────────────────────────────

/** User-provided instructions and memories appended to the system prompt. */
export interface PromptContext {
  globalInstructions: string;
  projectInstructions: string;
  globalMemories: string;
  projectMemories: string;
}

/**
 * Formats a handle ID for the system prompt so the LLM passes it as a quoted JSON string.
 */
function fmtId(id: string): string {
  return `"${id}"`;
}

function groupTools(schemas: ToolSchema[]): Map<string, ToolSchema[]> {
  const map = new Map<string, ToolSchema[]>();
  for (const schema of schemas) {
    const prefix = schema.name.split('_')[0];
    if (!map.has(prefix)) map.set(prefix, []);
    map.get(prefix)!.push(schema);
  }
  return map;
}

function renderTool(schema: ToolSchema): string {
  const props = (schema.parameters as Record<string, unknown>)['properties'] as
    | Record<string, { type?: string; description?: string }>
    | undefined;
  const required = new Set<string>(
    ((schema.parameters as Record<string, unknown>)['required'] as string[] | undefined) ?? [],
  );
  let paramStr = '';
  if (props && Object.keys(props).length > 0) {
    const parts = Object.entries(props).map(([name, def]) => {
      const opt = required.has(name) ? '' : '?';
      const type = def.type ?? 'any';
      const desc = def.description ? ` "${def.description}"` : '';
      return `${name}${opt} (${type})${desc}`;
    });
    paramStr = ` [${parts.join(', ')}]`;
  }
  const desc = schema.description ? ` — ${schema.description}` : '';
  return `  \`${schema.name}\`${paramStr}${desc}`;
}

function renderDevice(d: DeviceInfo, indent = '      '): string {
  // Keep device names + ids; omit individual parameter values to save tokens.
  // The LLM can call get_live_state when it needs exact parameter ids/values.
  const sampleStr = d.samplePath ? ` [sample: ${d.samplePath}]` : '';
  const chainStr =
    d.chains && d.chains.length > 0
      ? ' chains: ' + d.chains.map((c) => `"${c.name}"(id:${fmtId(c.id)})`).join(', ')
      : '';
  return `${indent}Device: "${d.name}" (id:${fmtId(d.id)})${sampleStr}${chainStr}`;
}

function renderClip(c: ClipInfo, indent: string): string {
  const flags = [c.looping ? 'loop' : '', c.muted ? 'muted' : ''].filter(Boolean).join(',');
  const flagStr = flags ? ` [${flags}]` : '';
  const label = c.slotIndex >= 0 ? `Clip[${c.slotIndex}]` : `ArrangementClip`;
  // Omit note-by-note data from the overview — notes can be huge and the LLM
  // can call get_live_state when it needs them for editing.
  const noteHint =
    c.notes && c.notes.length > 0 ? ` (${c.notes.length} notes — call get_live_state to read)` : '';
  const audioStr =
    c.filePath !== undefined
      ? ` audio:${c.filePath.split('/').pop()}${c.warpMode !== undefined ? ` warpMode:${c.warpMode}` : ''}`
      : '';
  return `${indent}${label}: "${c.name}" (id:${fmtId(c.id)}) — ${c.duration} beats${flagStr}${noteHint}${audioStr}`;
}

function renderTrack(t: TrackInfo): string {
  const flags = [t.mute ? 'muted' : '', t.solo ? 'solo' : '', t.arm ? 'armed' : '']
    .filter(Boolean)
    .join(',');
  const flagStr = flags ? ` [${flags}]` : '';
  const sendStr = t.mixer.sends.length
    ? ' sends:' + t.mixer.sends.map((s, i) => `[${i}]=${s.value.toFixed(2)}`).join(' ')
    : '';
  const mixerStr = `\n      Mixer: vol=${t.mixer.volume.value.toFixed(2)}(id:${fmtId(t.mixer.volume.id)}) pan=${t.mixer.panning.value.toFixed(2)}(id:${fmtId(t.mixer.panning.id)})${sendStr}`;
  const devStr = t.devices.length ? '\n' + t.devices.map((d) => renderDevice(d)).join('\n') : '';
  const sessionClipStr = t.sessionClips.map((c) => renderClip(c, '      ')).join('\n');
  const arrangementClipStr = t.arrangementClips.map((c) => renderClip(c, '      ')).join('\n');
  const clipStr = [sessionClipStr, arrangementClipStr].filter(Boolean).join('\n');
  // Show take-lane count only; listing names/ids saved for when the LLM needs them
  const laneHint = t.takeLanes.length ? `\n      TakeLanes: ${t.takeLanes.length}` : '';
  return `  [${t.type}] "${t.name}" (id:${fmtId(t.id)})${flagStr}${mixerStr}${devStr}${clipStr ? '\n' + clipStr : ''}${laneHint}`;
}

/**
 * Builds the LLM system prompt from Live session state, tool schemas, and optional user context.
 */
export function buildSystemPrompt(
  liveState: LiveState,
  toolSchemas: ToolSchema[],
  context: PromptContext = {
    globalInstructions: '',
    projectInstructions: '',
    globalMemories: '',
    projectMemories: '',
  },
): string {
  const trackList = liveState.tracks.map(renderTrack).join('\n');

  const sceneStr = liveState.scenes.length
    ? liveState.scenes.map((s) => `  "${s.name}" (id:${fmtId(s.id)}) ${s.tempo}bpm`).join('\n') +
      '\n  (A scene tempo of -1 means the scene inherits the Song tempo and has no override set.)'
    : '  (none)';

  const cueStr = liveState.cuePoints.length
    ? liveState.cuePoints.map((cp) => `  "${cp.name}" (id:${fmtId(cp.id)}) @${cp.time}`).join('\n')
    : '  (none)';

  const mainStr = `  Master: vol (id:${fmtId(liveState.mainTrack.mixer.volume.id)}) pan (id:${fmtId(liveState.mainTrack.mixer.panning.id)})`;

  const GROUP_ORDER = [
    'get',
    'song',
    'track',
    'midi',
    'audio',
    'clip',
    'device',
    'scene',
    'cue',
    'rack',
    'chain',
    'simpler',
    'take',
  ];
  const grouped = groupTools(toolSchemas);
  const sortedGroups = [
    ...GROUP_ORDER.filter((g) => grouped.has(g)),
    ...[...grouped.keys()].filter((g) => !GROUP_ORDER.includes(g)).sort(),
  ];
  const toolRef = sortedGroups
    .map((g) => `### ${g}_*\n${grouped.get(g)!.map(renderTool).join('\n')}`)
    .join('\n\n');

  let prompt = `You are Live Agent, an AI assistant embedded directly in Ableton Live.
You help music producers control their session using natural language.

## Current session state
- Tempo: ${liveState.tempo} BPM
- Key/Scale: root=${liveState.rootNote} "${liveState.scaleName}" scaleMode=${liveState.scaleMode} intervals=[${liveState.scaleIntervals.join(', ')}]
- Tracks (${liveState.trackCount} regular + ${liveState.tracks.filter((t) => t.type === 'return').length} return):
${trackList || '  (no tracks yet)'}
- Scenes:
${sceneStr}
- Cue points:
${cueStr}
- Master output:
${mainStr}

## Key workflows
- Creating a track: \`song_create_midi_track\` / \`song_create_audio_track\`, then \`track_set_name\` immediately (create has no name param).
- **Session clips (main grid):** \`clip_slot_create_midi_clip\` on slot 0 → \`midi_clip_set_notes\`. Do **not** use \`midi_track_create_midi_clip\` unless the user explicitly wants arrangement-timeline clips.
- **Learning & reference:** call \`web_search\` when the user wants to learn, look something up, or asks about production technique, mixing, sound design, Ableton Live workflows, or built-in devices/plugins — not only song tabs. Pass focused queries (e.g. "sidechain compression Ableton", "Operator FM bass site:ableton.com"). Prefer \`source: "tab"\` or \`source: "docs"\` excerpts over guessing; cite the source briefly when teaching. Combine explanation with action when helpful — demonstrate in the session using tools after looking up the technique.
- **Reading ASCII bass tab:** standard 4-string bass tuning is E1 A1 D2 G2. The four rows in a tab are (top→bottom) G D A E strings. A number on a row = fret played on that string; MIDI pitch = open-string MIDI + fret number. Open MIDI values: E1=28, A1=33, D2=38, G2=43. Example: A string fret 5 → 33+5=38=D2; E string fret 7 → 28+7=35=B1. Count the number of note symbols per beat to determine whether notes are quarter (1 per beat), eighth (2 per beat), or sixteenth (4 per beat).
- **Reading ASCII guitar tab:** standard 6-string guitar tuning is E2 A2 D3 G3 B3 E4. Open MIDI values: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64. Drop-D lowers only the bottom E string to D2=38. Same fret math: open MIDI + fret number = pitch. Tab rows are (top→bottom) E4 B3 G3 D3 A2 E2.
- **GM drum map (for drum programming):** kick=36, snare=38, closed hi-hat=42, open hi-hat=46, low tom=41, mid tom=47, high tom=50, crash cymbal=49, ride cymbal=51, rim shot=37, clap=39, cowbell=56. These are the standard MIDI note numbers to use in \`midi_clip_set_notes\` when building drum patterns.
- **Tab search queries:** always include the song title and "bass tab" when searching for note detail (e.g. "With or Without You U2 bass tab"). If the first search returns links without tab text, do not repeat the same query — try a shorter, more direct query instead.
- Audible MIDI: insert **Operator**, **Analog**, or **Drift** for immediate synth sound. Drum Rack / Sampler start empty — load audio via \`resources_import_into_project\` + \`simpler_replace_sample\`, or use a synth instead.
- Writing MIDI notes: \`midi_clip_set_notes\` with NoteDescription objects \`{pitch, startTime, duration, velocity, releaseVelocity?, muted?, probability?}\`.
- Tweaking a device parameter: get its id from the session state above, then \`device_parameter_set_value\`. The state shows current value and [min–max] range.
- Mixer (volume/pan/sends): use \`device_parameter_set_value\` with the mixer parameter ids shown in the track's Mixer line.
- Cleaning a new set: delete extra tracks but Live always keeps at least one — clear devices on the last track or repurpose it instead of deleting everything.
- Track ids in the session overview go stale after deletes/creates. Tool results include a \`liveSnapshot\` with current ids when the layout changes — use those ids for follow-up steps.
- When ids are stale: call \`get_live_state\` to refresh the full snapshot.
- When a tool returns \`{ ok: false, error: "..." }\`, read the error and \`liveSnapshot\` if present, then try an alternative — do not stop after a single failure.
- Long tasks pause every ~5 steps for user approval (Review/Guard modes only; Auto skips step prompts) — keep going efficiently within each batch.
- Inserting into a rack: use \`rack_device_insert_chain\` to add a chain, then \`chain_insert_device\` to add devices inside it.
- **Before claiming a task is done:** call \`get_live_state\` and verify session clips (Clip[0]…), notes, tempo, and audible devices match the request. Never claim success if only arrangement clips exist when session clips were requested, or if Drum Rack/Sampler have no loaded sounds.

## Rules
- IDs are handle strings — they change if objects are moved. Refresh with \`get_live_state\` when unsure.
- Only built-in Live devices can be loaded via \`track_insert_device\` / \`chain_insert_device\`. Valid names: "Analog", "Drift", "Meld", "Operator", "Sampler", "Simpler", "Drum Rack", "Instrument Rack", "Audio Effect Rack", "MIDI Effect Rack", "Auto Filter", "Auto Pan", "Beat Repeat", "Chorus-Ensemble", "Compressor", "Corpus", "Delay", "Dynamic Tube", "Echo", "EQ Eight", "EQ Three", "Erosion", "Filter Delay", "Flanger", "Frequency Shifter", "Gate", "Glue Compressor", "Grain Delay", "Limiter", "Looper", "Multiband Dynamics", "Overdrive", "Pedal", "Phaser-Flanger", "Redux", "Resonators", "Reverb", "Saturator", "Shifter", "Spectral Blur", "Spectral Time", "Spectrum", "Tuner", "Utility", "Vinyl Distortion", "Vocoder".
- Be concise — producers are focused on music, not explanations.
- If something is genuinely impossible, say so and suggest the nearest alternative.

## Full tool reference (auto-generated from SDK — updates automatically with \`npm run generate\`)
${toolRef}`;

  const contextSections: Array<{ heading: string; content: string }> = [
    { heading: 'Your instructions', content: context.globalInstructions },
    { heading: 'Project instructions', content: context.projectInstructions },
    { heading: 'About you', content: context.globalMemories },
    { heading: 'About this project', content: context.projectMemories },
  ];

  for (const { heading, content } of contextSections) {
    const trimmed = content.trim();
    if (trimmed) {
      prompt += `\n\n## ${heading}\n${trimmed}`;
    }
  }

  return prompt;
}
