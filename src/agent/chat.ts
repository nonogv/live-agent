import type { ToolSchema } from '../providers/index.js';

export interface DeviceInfo {
  id: string;
  name: string;
  parameters: Array<{ id: string; name: string; value: number }>;
}

export interface LiveState {
  tempo: number;
  trackCount: number;
  tracks: Array<{ id: string; name: string; type: string; devices: DeviceInfo[] }>;
}

/**
 * Groups tool schemas by their object-type prefix (e.g. "song", "track", "clip").
 * Tools named "foo_bar_baz" are grouped under "foo".
 * The special prefix "get" covers cross-cutting read tools like get_live_state.
 */
function groupTools(schemas: ToolSchema[]): Map<string, ToolSchema[]> {
  const map = new Map<string, ToolSchema[]>();
  for (const schema of schemas) {
    const prefix = schema.name.split('_')[0];
    if (!map.has(prefix)) map.set(prefix, []);
    map.get(prefix)!.push(schema);
  }
  return map;
}

/**
 * Renders a single tool as a compact one-liner with its parameters.
 *   `tool_name` [required1 (type), optional2? (type)] — description
 */
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

export function buildSystemPrompt(liveState: LiveState, toolSchemas: ToolSchema[]): string {
  const trackList = liveState.tracks
    .map((t, i) => {
      const devStr = t.devices.length
        ? '\n' +
          t.devices
            .map((d) => {
              const paramStr = d.parameters
                .map((p) => `        - ${p.name} (id:${p.id}) = ${p.value}`)
                .join('\n');
              return `      Device: "${d.name}" (id:${d.id})${paramStr ? '\n' + paramStr : ''}`;
            })
            .join('\n')
        : '';
      return `  ${i + 1}. [${t.type}] "${t.name}" (id: ${t.id})${devStr}`;
    })
    .join('\n');

  // Build the full tool reference from the actual schemas, grouped by object type.
  const grouped = groupTools(toolSchemas);
  const GROUP_ORDER = [
    'get',
    'song',
    'track',
    'midi',
    'audio',
    'clip',
    'device',
    'scene',
    'simpler',
    'take',
  ];
  const sortedGroups = [
    ...GROUP_ORDER.filter((g) => grouped.has(g)),
    ...[...grouped.keys()].filter((g) => !GROUP_ORDER.includes(g)).sort(),
  ];

  const toolRef = sortedGroups
    .map((g) => {
      const tools = grouped.get(g)!;
      return `### ${g}_*\n${tools.map(renderTool).join('\n')}`;
    })
    .join('\n\n');

  return `You are Live Agent, an AI assistant embedded directly in Ableton Live.
You help music producers control their session using natural language.

## Current session state
- Tempo: ${liveState.tempo} BPM
- Tracks (${liveState.trackCount}):
${trackList || '  (no tracks yet)'}

## Key workflows
- Creating a track: call \`song_create_midi_track\` or \`song_create_audio_track\`, then immediately \`track_set_name\` (create has no name param).
- Renaming: \`track_set_name\`, \`clip_set_name\`, \`scene_set_name\` — all take an \`id\` + \`value\`.
- Writing MIDI: \`clip_slot_create_midi_clip\` to create, then \`midi_clip_set_notes\` with an array of NoteDescription objects \`{pitch, startTime, duration, velocity, releaseVelocity}\`.
- Tweaking a device parameter: get the parameter id from the session state above, then call \`device_parameter_set_value\`.
- When track/clip ids are stale or unknown: call \`get_live_state\` to refresh.

## Rules
- IDs are handle strings — they change if objects are moved. Refresh with \`get_live_state\` when unsure.
- Only built-in Live devices can be loaded via \`track_insert_device\` (no third-party plug-ins). Valid device names: "Analog", "Drift", "Meld", "Operator", "Sampler", "Simpler", "Drum Rack", "Auto Filter", "Auto Pan", "Beat Repeat", "Chorus-Ensemble", "Compressor", "Corpus", "Delay", "Dynamic Tube", "Echo", "EQ Eight", "EQ Three", "Erosion", "Filter Delay", "Flanger", "Frequency Shifter", "Gate", "Glue Compressor", "Grain Delay", "Limiter", "Looper", "Multiband Dynamics", "Overdrive", "Pedal", "Phaser-Flanger", "Redux", "Resonators", "Reverb", "Saturator", "Shifter", "Spectral Blur", "Spectral Time", "Spectrum", "Tuner", "Utility", "Vinyl Distortion", "Vocoder".
- Be concise — producers are focused on music, not explanations.
- If something is genuinely impossible with the available tools, say so and suggest the nearest alternative.

## Full tool reference (auto-generated from SDK)
${toolRef}`;
}
