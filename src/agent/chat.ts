import type { ToolSchema } from '../providers/index.js';

// ─── Live state types ─────────────────────────────────────────────────────────

export interface NoteInfo {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
}

export interface ClipInfo {
  id: string;
  name: string;
  slotIndex: number; // -1 for arrangement clips
  duration: number;
  looping: boolean;
  muted: boolean;
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
  }>;
  chains?: Array<{ id: string; name: string; devices: DeviceInfo[] }>;
}

export interface MixerInfo {
  volume: { id: string; value: number };
  panning: { id: string; value: number };
  sends: Array<{ id: string; value: number }>;
}

export interface TrackInfo {
  id: string;
  name: string;
  type: 'midi' | 'audio' | 'return';
  mute: boolean;
  solo: boolean;
  arm: boolean;
  mixer: MixerInfo;
  devices: DeviceInfo[];
  sessionClips: ClipInfo[];
  arrangementClips: ClipInfo[];
  takeLanes: Array<{ id: string; name: string }>;
}

export interface LiveState {
  tempo: number;
  trackCount: number;
  tracks: TrackInfo[];
  mainTrack: { id: string; mixer: MixerInfo };
  scenes: Array<{ id: string; name: string; tempo: number }>;
  cuePoints: Array<{ id: string; name: string; time: number }>;
}

// ─── System prompt ────────────────────────────────────────────────────────────

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
  const paramStr = d.parameters
    .map((p) => `${indent}  - ${p.name} (id:${p.id}) = ${p.value} [${p.min}–${p.max}]`)
    .join('\n');
  const sampleStr = d.samplePath ? `\n${indent}  sample: ${d.samplePath}` : '';
  const chainStr =
    d.chains && d.chains.length > 0
      ? '\n' +
        d.chains
          .map((c) => {
            const chainDevices = c.devices
              .map((cd) => renderDevice(cd, indent + '    '))
              .join('\n');
            return `${indent}  Chain "${c.name}" (id:${c.id})${chainDevices ? '\n' + chainDevices : ''}`;
          })
          .join('\n')
      : '';
  return `${indent}Device: "${d.name}" (id:${d.id})${sampleStr}${paramStr ? '\n' + paramStr : ''}${chainStr}`;
}

function renderClip(c: ClipInfo, indent: string): string {
  const flags = [c.looping ? 'loop' : '', c.muted ? 'muted' : ''].filter(Boolean).join(',');
  const flagStr = flags ? ` [${flags}]` : '';
  const label = c.slotIndex >= 0 ? `Clip[${c.slotIndex}]` : `ArrangementClip`;
  const noteStr =
    c.notes && c.notes.length > 0
      ? `\n${indent}  Notes: ` +
        c.notes
          .map((n) => `p:${n.pitch} t:${n.startTime} d:${n.duration} v:${n.velocity}`)
          .join(', ')
      : '';
  return `${indent}${label}: "${c.name}" (id:${c.id}) — ${c.duration} beats${flagStr}${noteStr}`;
}

function renderTrack(t: TrackInfo): string {
  const flags = [t.mute ? 'muted' : '', t.solo ? 'solo' : '', t.arm ? 'armed' : '']
    .filter(Boolean)
    .join(',');
  const flagStr = flags ? ` [${flags}]` : '';
  const mixerStr = `\n      Mixer: vol=${t.mixer.volume.value.toFixed(2)} (id:${t.mixer.volume.id}) pan=${t.mixer.panning.value.toFixed(2)} (id:${t.mixer.panning.id})${t.mixer.sends.length ? ' sends:' + t.mixer.sends.map((s, i) => `[${i}]=${s.value.toFixed(2)}(id:${s.id})`).join(' ') : ''}`;
  const devStr = t.devices.length ? '\n' + t.devices.map((d) => renderDevice(d)).join('\n') : '';
  const clipStr = [
    ...t.sessionClips.map((c) => renderClip(c, '      ')),
    ...t.arrangementClips.map((c) => renderClip(c, '      ')),
  ].join('\n');
  const laneStr = t.takeLanes.length
    ? '\n      TakeLanes: ' + t.takeLanes.map((tl) => `"${tl.name}" (id:${tl.id})`).join(', ')
    : '';
  return `  [${t.type}] "${t.name}" (id:${t.id})${flagStr}${mixerStr}${devStr}${clipStr ? '\n' + clipStr : ''}${laneStr}`;
}

export function buildSystemPrompt(liveState: LiveState, toolSchemas: ToolSchema[]): string {
  const trackList = liveState.tracks.map(renderTrack).join('\n');

  const sceneStr = liveState.scenes.length
    ? liveState.scenes.map((s) => `  "${s.name}" (id:${s.id}) ${s.tempo}bpm`).join('\n')
    : '  (none)';

  const cueStr = liveState.cuePoints.length
    ? liveState.cuePoints.map((cp) => `  "${cp.name}" (id:${cp.id}) @${cp.time}`).join('\n')
    : '  (none)';

  const mainStr = `  Master: vol (id:${liveState.mainTrack.mixer.volume.id}) pan (id:${liveState.mainTrack.mixer.panning.id})`;

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

  return `You are Live Agent, an AI assistant embedded directly in Ableton Live.
You help music producers control their session using natural language.

## Current session state
- Tempo: ${liveState.tempo} BPM
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
- Writing MIDI: \`clip_slot_create_midi_clip\` → \`midi_clip_set_notes\` with NoteDescription objects \`{pitch, startTime, duration, velocity, releaseVelocity?, muted?, probability?}\`.
- Tweaking a device parameter: get its id from the session state above, then \`device_parameter_set_value\`. The state shows current value and [min–max] range.
- Mixer (volume/pan/sends): use \`device_parameter_set_value\` with the mixer parameter ids shown in the track's Mixer line.
- When ids are stale: call \`get_live_state\` to refresh the full snapshot.
- Inserting into a rack: use \`rack_device_insert_chain\` to add a chain, then \`chain_insert_device\` to add devices inside it.

## Rules
- IDs are handle strings — they change if objects are moved. Refresh with \`get_live_state\` when unsure.
- Only built-in Live devices can be loaded via \`track_insert_device\` / \`chain_insert_device\`. Valid names: "Analog", "Drift", "Meld", "Operator", "Sampler", "Simpler", "Drum Rack", "Instrument Rack", "Audio Effect Rack", "MIDI Effect Rack", "Auto Filter", "Auto Pan", "Beat Repeat", "Chorus-Ensemble", "Compressor", "Corpus", "Delay", "Dynamic Tube", "Echo", "EQ Eight", "EQ Three", "Erosion", "Filter Delay", "Flanger", "Frequency Shifter", "Gate", "Glue Compressor", "Grain Delay", "Limiter", "Looper", "Multiband Dynamics", "Overdrive", "Pedal", "Phaser-Flanger", "Redux", "Resonators", "Reverb", "Saturator", "Shifter", "Spectral Blur", "Spectral Time", "Spectrum", "Tuner", "Utility", "Vinyl Distortion", "Vocoder".
- Be concise — producers are focused on music, not explanations.
- If something is genuinely impossible, say so and suggest the nearest alternative.

## Full tool reference (auto-generated from SDK — updates automatically with \`npm run generate\`)
${toolRef}`;
}
