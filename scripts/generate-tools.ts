/**
 * SDK Discovery — Tool Schema Generator
 *
 * Reads the Ableton Extensions SDK TypeScript types and auto-generates:
 *   src/agent/generated-tools.ts   — tool schemas for all AI providers
 *   src/live/generated-executor.ts — executor that maps tool calls to SDK calls
 *
 * Run: npm run generate
 *
 * Re-run whenever the SDK is updated to get new tools automatically.
 */

import { Project, ClassDeclaration, MethodDeclaration, ParameterDeclaration, Type } from 'ts-morph';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SDK_TYPES = path.join(ROOT, 'node_modules/@ableton-extensions/sdk/dist/index.d.mts');
const OUT_TOOLS = path.join(ROOT, 'src/agent/generated-tools.ts');
const OUT_EXECUTOR = path.join(ROOT, 'src/live/generated-executor.ts');

// ─── SDK object class names — these become handle-id references in tool params ─
const SDK_OBJECT_CLASSES = new Set([
  'Track',
  'MidiTrack',
  'AudioTrack',
  'Clip',
  'MidiClip',
  'AudioClip',
  'ClipSlot',
  'Scene',
  'Device',
  'DeviceParameter',
  'Simpler',
  'Sample',
  'TakeLane',
  'Chain',
  'DrumChain',
  'RackDevice',
  'DrumRack',
  'CuePoint',
  'DataModelObject',
]);

// ─── Classes to extract tools from (in order) ────────────────────────────────
export const TARGET_CLASSES = [
  'Song',
  'Track',
  'MidiTrack',
  'AudioTrack',
  'ClipSlot',
  'Clip',
  'MidiClip',
  'AudioClip',
  'Scene',
  'CuePoint',
  'Device',
  'DeviceParameter',
  'Simpler',
  'RackDevice',
  'Chain',
  'DrumChain',
  'TakeLane',
] as const;

/**
 * SDK classes with public API that are intentionally not tool-generated.
 * DrumRack inherits RackDevice tools (insertChain, etc.).
 */
export const EXCLUDED_SDK_CLASSES: Record<string, string> = {
  Application: 'Song is available from extension context — no separate tool needed',
  Commands: 'Extension command registration — not session control',
  Environment: 'Filesystem paths and locale — not music production',
  Resources: 'renderPreFxAudio / importIntoProject — future custom tools',
  Ui: 'Extension UI (dialogs, context menus) — not agent-controllable',
  DataModelObject: 'Base class — parent getter is navigational only',
  ChainMixer: 'Exposed via track/chain mixer parameters in get_live_state',
  TrackMixer: 'Exposed via track mixer parameters in get_live_state',
  Sample: 'Exposed via Simpler.sample in get_live_state',
  DrumRack: 'Methods inherited from RackDevice; chains are DrumChain instances',
  DataModelObjectRegistry: 'Internal handle cache',
};

/** Individual SDK members excluded from tool generation despite being on a TARGET_CLASS. */
export const EXCLUDED_SDK_MEMBERS: Record<string, string> = {};

// ─── Types ────────────────────────────────────────────────────────────────────

interface JsonSchemaProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface ToolParam {
  name: string; // parameter name in the tool schema
  originalName: string;
  schema: JsonSchemaProperty;
  required: boolean;
  isHandleRef: boolean; // true if this replaces an SDK object reference
  handleClass: string; // e.g. "Track"
}

export interface GeneratedTool {
  name: string; // e.g. song_createMidiTrack
  description: string;
  targetClass: string; // e.g. "Song"
  method: string; // e.g. "createMidiTrack"
  params: ToolParam[];
  returnDescription: string;
  hasContext: boolean; // needs additional context (track_id to find ClipSlot, etc.)
  contextParams: ToolParam[]; // e.g. track_id to locate the object
}

/**
 * Discovers all tools that should be generated from the current SDK types.
 */
export function discoverToolsFromSdk(): GeneratedTool[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(SDK_TYPES);
  const tools: GeneratedTool[] = [];

  for (const targetClassName of TARGET_CLASSES) {
    const cls = sourceFile.getClass(targetClassName);
    if (!cls) continue;
    tools.push(...extractMethods(cls, targetClassName));
    tools.push(...extractSetters(cls, targetClassName));
  }

  return tools;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Reading SDK types from', SDK_TYPES);

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(SDK_TYPES);

  const tools: GeneratedTool[] = [];

  for (const targetClassName of TARGET_CLASSES) {
    const cls = sourceFile.getClass(targetClassName);
    if (!cls) {
      console.warn(`  ⚠ Class "${targetClassName}" not found, skipping`);
      continue;
    }

    const classMethods = extractMethods(cls, targetClassName);
    tools.push(...classMethods);
    console.log(`  ✓ ${targetClassName}: ${classMethods.length} tools`);

    const setters = extractSetters(cls, targetClassName);
    tools.push(...setters);
    if (setters.length > 0) {
      console.log(`  ✓ ${targetClassName}: ${setters.length} setter tools`);
    }
  }

  console.log(`\nTotal tools generated: ${tools.length}`);

  const { formatCoverageSummary } = await import('./sdk-coverage.ts');
  console.log('\n' + formatCoverageSummary(tools));

  writeToolSchemas(tools);
  writeExecutor(tools);

  console.log('\nGenerated:');
  console.log(' ', OUT_TOOLS);
  console.log(' ', OUT_EXECUTOR);
}

// ─── Method extraction ────────────────────────────────────────────────────────

function extractMethods(cls: ClassDeclaration, className: string): GeneratedTool[] {
  const tools: GeneratedTool[] = [];

  for (const method of cls.getMethods()) {
    // Skip private, internal, constructor helpers
    if (method.hasModifier('private') || method.hasModifier('protected')) continue;

    const name = method.getName();

    // Skip methods inherited from DataModelObject that are unrelated to Live control
    if (['constructor', 'toString', 'valueOf'].includes(name)) continue;

    const jsDoc = getJsDoc(method);
    const params = buildParams(method, className);

    if (params === null) {
      // Skipped due to unsupported parameter type
      console.log(`    – Skipping ${className}.${name} (unsupported params)`);
      continue;
    }

    const toolName = toSnakeCase(`${className}_${name}`);
    const returnDesc = describeReturn(method);

    // Determine context params needed to locate the object
    const contextParams = getContextParams(className);

    tools.push({
      name: toolName,
      description: jsDoc || `Calls ${className}.${name}().`,
      targetClass: className,
      method: name,
      params,
      returnDescription: returnDesc,
      hasContext: contextParams.length > 0,
      contextParams,
    });
  }

  return tools;
}

function extractSetters(cls: ClassDeclaration, className: string): GeneratedTool[] {
  const tools: GeneratedTool[] = [];

  for (const setter of cls.getSetAccessors()) {
    if (setter.hasModifier('private') || setter.hasModifier('protected')) continue;

    const propName = setter.getName();
    const jsDoc = getJsDoc(setter);
    const paramType = setter.getParameters()[0]?.getType();
    if (!paramType) continue;

    const schema = typeToJsonSchema(paramType, propName, className);
    if (!schema) continue;

    const toolName = toSnakeCase(`${className}_set_${propName}`);
    const contextParams = getContextParams(className);

    const valueParam: ToolParam = {
      name: 'value',
      originalName: 'value',
      schema: { ...schema, description: schema.description || `New value for ${propName}.` },
      required: true,
      isHandleRef: false,
      handleClass: '',
    };

    tools.push({
      name: toolName,
      description: jsDoc || `Sets the ${propName} property on ${className}.`,
      targetClass: className,
      method: `set ${propName}`,
      params: [valueParam],
      returnDescription: 'void',
      hasContext: contextParams.length > 0,
      contextParams,
    });
  }

  return tools;
}

// ─── Parameter mapping ────────────────────────────────────────────────────────

function buildParams(method: MethodDeclaration, className: string): ToolParam[] | null {
  const result: ToolParam[] = [];

  for (const param of method.getParameters()) {
    const paramName = param.getName();
    const type = param.getType();
    const typeName = type.getText();

    // Skip callback parameters
    if (typeName.includes('=>') || typeName.includes('callback')) continue;

    // Check if this is an SDK object reference — use symbol name (resolves generics correctly)
    const sdkClass = getSdkClassName(type) ?? findSdkClass(typeName);
    if (sdkClass) {
      result.push({
        name: `${paramName}_id`,
        originalName: paramName,
        schema: {
          type: 'string',
          description: `Handle ID of the ${sdkClass} to act on.`,
        },
        required: !param.isOptional(),
        isHandleRef: true,
        handleClass: sdkClass,
      });
      continue;
    }

    // Object literal types (inline objects — e.g. args: { filePath: string; ... })
    if (type.isObject() && !type.isArray() && !type.isEnum()) {
      const inlineProps: Record<string, JsonSchemaProperty> = {};
      const required: string[] = [];

      for (const prop of type.getProperties()) {
        const propName = prop.getName();
        const propType = prop.getTypeAtLocation(method);
        const propSchema = typeToJsonSchema(propType, propName, className);
        if (!propSchema) continue;
        inlineProps[propName] = propSchema;
        if (!prop.isOptional()) required.push(propName);
      }

      result.push({
        name: paramName,
        originalName: paramName,
        schema: {
          type: 'object',
          description: `Configuration object for ${method.getName()}.`,
          properties: inlineProps,
          required,
        },
        required: !param.isOptional(),
        isHandleRef: false,
        handleClass: '',
      });
      continue;
    }

    const schema = typeToJsonSchema(type, paramName, className);
    if (schema === null) {
      // Completely unsupported type — skip the whole method
      return null;
    }

    result.push({
      name: paramName,
      originalName: paramName,
      schema,
      required: !param.isOptional(),
      isHandleRef: false,
      handleClass: '',
    });
  }

  return result;
}

/** Resolve SDK class name via the type's symbol (handles generics like Track<"1.0.0">) */
function getSdkClassName(type: Type): string | null {
  // Unwrap union (e.g. Track | undefined)
  if (type.isUnion()) {
    for (const t of type.getUnionTypes()) {
      const name = getSdkClassName(t);
      if (name) return name;
    }
  }
  const symbol = type.getSymbol() ?? type.getAliasSymbol();
  if (!symbol) return null;
  const name = symbol.getName();
  return SDK_OBJECT_CLASSES.has(name) ? name : null;
}

// ─── Type → JSON Schema ───────────────────────────────────────────────────────

function typeToJsonSchema(
  type: Type,
  paramName: string,
  contextClass: string,
): JsonSchemaProperty | null {
  const text = type.getText();

  // Unwrap Promise<T>
  if (text.startsWith('Promise<')) {
    const inner = type.getTypeArguments()[0];
    if (inner) return typeToJsonSchema(inner, paramName, contextClass);
  }

  // Unwrap T | undefined
  if (type.isUnion()) {
    const nonUndefined = type.getUnionTypes().filter((t) => !t.isUndefined());
    if (nonUndefined.length === 1)
      return typeToJsonSchema(nonUndefined[0], paramName, contextClass);
  }

  if (type.isString() || text === 'string') return { type: 'string', description: '' };
  if (type.isNumber() || text === 'number') return { type: 'number', description: '' };
  if (type.isBoolean() || text === 'boolean') return { type: 'boolean', description: '' };
  if (type.isNull() || type.isUndefined() || type.isVoid())
    return { type: 'null', description: '' };

  // Enum — resolve actual member names and values instead of raw TS type path
  if (type.isEnum() || type.isEnumLiteral()) {
    const symbol = type.getSymbol() ?? type.getAliasSymbol();
    const members =
      symbol
        ?.getDeclarations()
        .flatMap((d) =>
          'getMembers' in d ? (d as unknown as { getMembers(): unknown[] }).getMembers() : [],
        )
        .map((m: unknown) => {
          const member = m as { getName(): string; getValue(): string | number | undefined };
          return `${member.getValue() ?? 0} (${member.getName()})`;
        }) ?? [];
    const desc = members.length > 0 ? `One of: ${members.join(', ')}` : `Enum value (number)`;
    return { type: 'number', description: desc };
  }

  // Literal union (e.g. "beats" | "tones")
  if (type.isUnion()) {
    const members = type.getUnionTypes();
    if (members.every((m) => m.isStringLiteral())) {
      return {
        type: 'string',
        description: '',
        enum: members.map((m) => m.getLiteralValue() as string),
      };
    }
  }

  // Array types
  if (type.isArray()) {
    const elementType = type.getArrayElementType();
    if (elementType) {
      const items = typeToJsonSchema(elementType, paramName, contextClass);
      if (items) {
        return { type: 'array', description: '', items };
      }
    }
  }

  // ClipLoopSettings — optional loop region for createAudioClip args
  if (text.includes('ClipLoopSettings')) {
    return {
      type: 'object',
      description:
        'Initial loop region and markers for a new audio clip (all positions in beats). ' +
        'When looping is false, loopStart equals startMarker and loopEnd equals endMarker.',
      properties: {
        looping: { type: 'boolean', description: 'Whether the clip loops.' },
        startMarker: { type: 'number', description: 'Start marker position in beats.' },
        endMarker: { type: 'number', description: 'End marker position in beats.' },
        loopStart: { type: 'number', description: 'Loop start position in beats.' },
        loopEnd: { type: 'number', description: 'Loop end position in beats.' },
      },
      required: ['looping', 'startMarker', 'endMarker', 'loopStart', 'loopEnd'],
    };
  }

  // NoteDescription
  if (text.includes('NoteDescription')) {
    return {
      type: 'object',
      description: 'A MIDI note.',
      properties: {
        pitch: { type: 'number', description: 'MIDI note number (0–127).' },
        startTime: { type: 'number', description: 'Start time in beats.' },
        duration: { type: 'number', description: 'Duration in beats.' },
        velocity: { type: 'number', description: 'Velocity (0–127). Default: 100.' },
        releaseVelocity: { type: 'number', description: 'Release velocity (0–127). Optional.' },
        velocityDeviation: {
          type: 'number',
          description: 'Velocity deviation for randomization. Optional.',
        },
        muted: { type: 'boolean', description: 'Whether the note is muted.' },
        probability: { type: 'number', description: 'Note probability (0–1).' },
        selected: { type: 'boolean', description: 'Whether the note is selected.' },
      },
      required: ['pitch', 'startTime', 'duration'],
    };
  }

  // SDK object types — replace with handle ID
  const sdkClass = getSdkClassName(type) ?? findSdkClass(text);
  if (sdkClass) {
    return {
      type: 'string',
      description: `Handle ID of the ${sdkClass}.`,
    };
  }

  // bigint
  if (text === 'bigint') return { type: 'number', description: '' };

  // Unknown — log and return null to skip method
  return null;
}

// ─── Context params ───────────────────────────────────────────────────────────

/**
 * Some classes aren't the root of the hierarchy — they need additional
 * params to locate them (e.g. ClipSlot needs track_id + slot_index).
 */
function getContextParams(className: string): ToolParam[] {
  switch (className) {
    case 'ClipSlot':
      return [
        {
          name: 'track_id',
          originalName: 'track_id',
          schema: {
            type: 'string',
            description: 'Handle ID of the track containing this clip slot.',
          },
          required: true,
          isHandleRef: true,
          handleClass: 'Track',
        },
        {
          name: 'slot_index',
          originalName: 'slot_index',
          schema: { type: 'number', description: '0-based index of the clip slot on the track.' },
          required: true,
          isHandleRef: false,
          handleClass: '',
        },
      ];
    case 'TakeLane':
      return [
        {
          name: 'take_lane_id',
          originalName: 'take_lane_id',
          schema: { type: 'string', description: 'Handle ID of the take lane.' },
          required: true,
          isHandleRef: true,
          handleClass: 'TakeLane',
        },
      ];
    case 'Track':
    case 'MidiTrack':
    case 'AudioTrack':
    case 'Clip':
    case 'MidiClip':
    case 'AudioClip':
    case 'Scene':
    case 'CuePoint':
    case 'Device':
    case 'DeviceParameter':
    case 'Simpler':
    case 'RackDevice':
    case 'Chain':
    case 'DrumChain':
      return [
        {
          name: `${toSnakeCase(className)}_id`,
          originalName: `${toSnakeCase(className)}_id`,
          schema: {
            type: 'string',
            description: `Handle ID of the ${className} to act on.`,
          },
          required: true,
          isHandleRef: true,
          handleClass: className,
        },
      ];
    default:
      return []; // Song is the root, needs no context
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findSdkClass(typeName: string): string | null {
  for (const cls of SDK_OBJECT_CLASSES) {
    if (typeName.startsWith(`${cls}<`) || typeName === cls) return cls;
  }
  return null;
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');
}

function getJsDoc(
  node: MethodDeclaration | ReturnType<ClassDeclaration['getSetAccessors']>[0],
): string {
  const docs = node.getJsDocs();
  if (docs.length === 0) return '';
  return docs
    .map((d) => d.getDescription().trim())
    .join(' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function describeReturn(method: MethodDeclaration): string {
  const ret = method.getReturnType().getText();
  if (ret.startsWith('Promise<')) {
    // Keep Promise<void> distinct from sync void so the executor awaits it.
    return ret;
  }
  return ret;
}

// ─── Output: Tool Schemas ─────────────────────────────────────────────────────

function writeToolSchemas(tools: GeneratedTool[]) {
  const lines: string[] = [
    `// AUTO-GENERATED by scripts/generate-tools.ts — DO NOT EDIT MANUALLY`,
    `// Run \`npm run generate\` to regenerate from the current SDK types.`,
    `// Generated at: ${new Date().toISOString()}`,
    ``,
    `import type { ToolSchema } from "../providers/index.js";`,
    ``,
    `export const GENERATED_TOOL_SCHEMAS: ToolSchema[] = [`,
  ];

  for (const tool of tools) {
    const allParams = [...tool.contextParams, ...tool.params];
    const required = allParams.filter((p) => p.required).map((p) => p.name);
    const properties: Record<string, unknown> = {};
    for (const p of allParams) {
      properties[p.name] = p.schema;
    }

    lines.push(`  {`);
    lines.push(`    name: ${JSON.stringify(tool.name)},`);
    lines.push(`    description: ${JSON.stringify(tool.description)},`);
    lines.push(`    parameters: {`);
    lines.push(`      type: "object",`);
    lines.push(
      `      properties: ${JSON.stringify(properties, null, 6).split('\n').join('\n      ')},`,
    );
    if (required.length > 0) {
      lines.push(`      required: ${JSON.stringify(required)},`);
    }
    lines.push(`    },`);
    lines.push(`  },`);
  }

  lines.push(`];`);
  lines.push(``);

  fs.writeFileSync(OUT_TOOLS, lines.join('\n'), 'utf-8');
}

// ─── Output: Executor ─────────────────────────────────────────────────────────

function writeExecutor(tools: GeneratedTool[]) {
  const lines: string[] = [
    `// AUTO-GENERATED by scripts/generate-tools.ts — DO NOT EDIT MANUALLY`,
    `// Run \`npm run generate\` to regenerate from the current SDK types.`,
    `// Generated at: ${new Date().toISOString()}`,
    ``,
    `import {`,
    `  MidiTrack, AudioTrack, MidiClip, AudioClip, ClipSlot, Device, DeviceParameter, Simpler, TakeLane, RackDevice, DrumChain,`,
    `  type Song,`,
    `} from "@ableton-extensions/sdk";`,
    `import { resolveHandle } from "./handle-registry.js";`,
    ``,
    `// ─── Handle ID parsing ─────────────────────────────────────────────────────`,
    ``,
    `/**`,
    ` * Normalizes a handle id from tool-call JSON.`,
    ` *`,
    ` * When the LLM emits a large BigInt handle as a plain JSON number, JSON.parse`,
    ` * rounds it to the nearest float64. resolveHandle() recovers the exact string`,
    ` * from the registry that getLiveState() populated before this turn.`,
    ` */`,
    `export function parseHandleArg(s: string | number): string {`,
    `  const resolved = resolveHandle(s);`,
    `  if (resolved !== null) return resolved;`,
    `  if (typeof s === "string") return s;`,
    `  return String(s);`,
    `}`,
    ``,
    `// ─── Object finders ────────────────────────────────────────────────────────`,
    ``,
    `function findTrack(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  const t = song.tracks.find(t => t.handle.id.toString() === normalized);`,
    `  if (!t) throw new Error(\`Track "\${normalized}" not found. Call song_get_tracks to refresh.\`);`,
    `  return t;`,
    `}`,
    ``,
    `function findScene(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  const s = song.scenes.find(s => s.handle.id.toString() === normalized);`,
    `  if (!s) throw new Error(\`Scene "\${normalized}" not found.\`);`,
    `  return s;`,
    `}`,
    ``,
    `function findClip(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  for (const track of song.tracks) {`,
    `    for (const slot of track.clipSlots) {`,
    `      if (slot.clip?.handle.id.toString() === normalized) return slot.clip;`,
    `    }`,
    `    for (const clip of track.arrangementClips) {`,
    `      if (clip.handle.id.toString() === normalized) return clip;`,
    `    }`,
    `  }`,
    `  throw new Error(\`Clip "\${normalized}" not found.\`);`,
    `}`,
    ``,
    `function allDevices(song: Song<"1.0.0">): Device<"1.0.0">[] {`,
    `  const result: Device<"1.0.0">[] = [];`,
    `  const allTracks = [...song.tracks, ...song.returnTracks, song.mainTrack];`,
    `  function collectDevices(devices: Device<"1.0.0">[]) {`,
    `    for (const d of devices) {`,
    `      result.push(d);`,
    `      if (d instanceof RackDevice) {`,
    `        for (const chain of d.chains) collectDevices(chain.devices);`,
    `      }`,
    `    }`,
    `  }`,
    `  for (const track of allTracks) collectDevices(track.devices);`,
    `  return result;`,
    `}`,
    ``,
    `function findDevice(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  const device = allDevices(song).find(d => d.handle.id.toString() === normalized);`,
    `  if (!device) throw new Error(\`Device "\${normalized}" not found.\`);`,
    `  return device;`,
    `}`,
    ``,
    `function findDeviceParameter(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  for (const device of allDevices(song)) {`,
    `    for (const param of device.parameters) {`,
    `      if (param.handle.id.toString() === normalized) return param;`,
    `    }`,
    `  }`,
    `  throw new Error(\`DeviceParameter "\${normalized}" not found.\`);`,
    `}`,
    ``,
    `function findChain(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  for (const device of allDevices(song)) {`,
    `    if (device instanceof RackDevice) {`,
    `      const chain = device.chains.find(c => c.handle.id.toString() === normalized);`,
    `      if (chain) return chain;`,
    `    }`,
    `  }`,
    `  throw new Error(\`Chain "\${normalized}" not found.\`);`,
    `}`,
    ``,
    `function findRackDevice(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  const device = findDevice(song, normalized);`,
    `  if (!(device instanceof RackDevice)) throw new Error(\`Device "\${normalized}" is not a RackDevice.\`);`,
    `  return device;`,
    `}`,
    ``,
    `function findCuePoint(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  const cp = song.cuePoints.find(cp => cp.handle.id.toString() === normalized);`,
    `  if (!cp) throw new Error(\`CuePoint "\${normalized}" not found.\`);`,
    `  return cp;`,
    `}`,
    ``,
    `function findTakeLane(song: Song<"1.0.0">, id: string | number) {`,
    `  const normalized = parseHandleArg(id);`,
    `  for (const track of song.tracks) {`,
    `    for (const lane of track.takeLanes) {`,
    `      if (lane.handle.id.toString() === normalized) return lane;`,
    `    }`,
    `  }`,
    `  throw new Error(\`TakeLane "\${normalized}" not found.\`);`,
    `}`,
    ``,
    `function serializeHandle(obj: { handle: { id: bigint } } | null) {`,
    `  if (!obj) return null;`,
    `  return { id: obj.handle.id.toString() };`,
    `}`,
    ``,
    `function serializeResult(result: unknown): unknown {`,
    `  if (result === null || result === undefined) return null;`,
    `  if (typeof result === "object" && "handle" in (result as object)) {`,
    `    const obj = result as { handle: { id: bigint }; name?: string };`,
    `    return { id: obj.handle.id.toString(), name: obj.name ?? undefined };`,
    `  }`,
    `  return result;`,
    `}`,
    ``,
    `function findByHandleClass(song: Song<"1.0.0">, cls: string, id: string | number): unknown {`,
    `  switch (cls) {`,
    `    case "Track": case "MidiTrack": case "AudioTrack": return findTrack(song, id);`,
    `    case "Scene": return findScene(song, id);`,
    `    case "Clip": case "MidiClip": case "AudioClip": return findClip(song, id);`,
    `    case "Device": return findDevice(song, id);`,
    `    case "DeviceParameter": return findDeviceParameter(song, id);`,
    `    case "TakeLane": return findTakeLane(song, id);`,
    `    case "RackDevice": case "DrumRack": return findRackDevice(song, id);`,
    `    case "Chain": case "DrumChain": return findChain(song, id);`,
    `    case "CuePoint": return findCuePoint(song, id);`,
    `    default: throw new Error(\`Cannot find object of class "\${cls}" by ID\`);`,
    `  }`,
    `}`,
    ``,
    `// ─── Dispatcher ────────────────────────────────────────────────────────────`,
    ``,
    `export async function executeGeneratedTool(`,
    `  song: Song<"1.0.0">,`,
    `  name: string,`,
    `  args: Record<string, unknown>`,
    `): Promise<unknown> {`,
    `  switch (name) {`,
  ];

  for (const tool of tools) {
    lines.push(`    case ${JSON.stringify(tool.name)}: {`);
    lines.push(`      ${generateDispatchBody(tool)}`);
    lines.push(`    }`);
  }

  lines.push(`    default:`);
  lines.push(`      throw new Error(\`Unknown generated tool: \${name}\`);`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);

  fs.writeFileSync(OUT_EXECUTOR, lines.join('\n'), 'utf-8');
}

function generateDispatchBody(tool: GeneratedTool): string {
  const { targetClass, method, params, contextParams } = tool;
  const a = 'args';

  // Resolve the target object
  let objectExpr = '';
  let prefix = '';

  switch (targetClass) {
    case 'Song':
      objectExpr = 'song';
      break;
    case 'Track': {
      const idParam = contextParams[0];
      prefix = `const _obj = findTrack(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'MidiTrack': {
      const idParam = contextParams[0];
      prefix = `const _baseTrack = findTrack(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      if (!(_baseTrack instanceof MidiTrack)) throw new Error("Track is not a MIDI track.");\n      const _obj = _baseTrack;\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'AudioTrack': {
      const idParam = contextParams[0];
      prefix = `const _baseTrack = findTrack(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      if (!(_baseTrack instanceof AudioTrack)) throw new Error("Track is not an Audio track.");\n      const _obj = _baseTrack;\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'ClipSlot': {
      prefix =
        [
          `const _track = findTrack(song, ${a}["track_id"] as string | number);`,
          `const _slotIdx = ${a}["slot_index"] as number;`,
          `const _obj = _track.clipSlots[_slotIdx];`,
          `if (!_obj) throw new Error(\`ClipSlot \${_slotIdx} not found.\`);`,
        ].join('\n      ') + '\n      ';
      objectExpr = '_obj';
      break;
    }
    case 'Clip': {
      const idParam = contextParams[0];
      prefix = `const _obj = findClip(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'MidiClip': {
      const idParam = contextParams[0];
      prefix = `const _baseClip = findClip(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      if (!(_baseClip instanceof MidiClip)) throw new Error("Clip is not a MIDI clip.");\n      const _obj = _baseClip;\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'AudioClip': {
      const idParam = contextParams[0];
      prefix = `const _baseClip = findClip(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      if (!(_baseClip instanceof AudioClip)) throw new Error("Clip is not an Audio clip.");\n      const _obj = _baseClip;\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'Scene': {
      const idParam = contextParams[0];
      prefix = `const _obj = findScene(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'Device': {
      const idParam = contextParams[0];
      prefix = `const _obj = findDevice(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'DeviceParameter': {
      const idParam = contextParams[0];
      prefix = `const _obj = findDeviceParameter(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'Simpler': {
      const idParam = contextParams[0];
      prefix = `const _rawDevice = findDevice(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      if (!(_rawDevice instanceof Simpler)) throw new Error("Device is not a Simpler");\n      const _obj = _rawDevice;\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'TakeLane': {
      const idParam = contextParams[0];
      prefix = `const _obj = findTakeLane(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'CuePoint': {
      const idParam = contextParams[0];
      prefix = `const _obj = findCuePoint(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'RackDevice': {
      const idParam = contextParams[0];
      prefix = `const _obj = findRackDevice(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'Chain': {
      const idParam = contextParams[0];
      prefix = `const _obj = findChain(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      `;
      objectExpr = '_obj';
      break;
    }
    case 'DrumChain': {
      const idParam = contextParams[0];
      prefix = `const _rawChain = findChain(song, ${a}[${JSON.stringify(idParam.name)}] as string | number);\n      if (!(_rawChain instanceof DrumChain)) throw new Error("Chain is not a DrumChain.");\n      const _obj = _rawChain;\n      `;
      objectExpr = '_obj';
      break;
    }
    default:
      return `throw new Error("Unimplemented target class: ${targetClass}");`;
  }

  // Build the method call
  if (method.startsWith('set ')) {
    const propName = method.slice(4);
    const valParam = params[0];
    // Always cast as `never` — the SDK type is correct at runtime; this is just a generator escape hatch
    const valExpr = valParam
      ? `${a}[${JSON.stringify(valParam.name)}] as never`
      : 'undefined as never';
    return `${prefix}${objectExpr}.${propName} = ${valExpr};\n      return { ok: true };`;
  }

  const methodArgs = params
    .map((p) => {
      if (p.isHandleRef) {
        // Resolve the handle and cast to the expected type
        return `findByHandleClass(song, "${p.handleClass}", ${a}[${JSON.stringify(p.name)}] as string | number) as never`;
      }
      const cast = p.schema.type === 'object' ? 'never' : getTypecast(p.schema.type);
      return `${a}[${JSON.stringify(p.name)}] as ${cast}`;
    })
    .join(', ');

  const isSyncVoid = tool.returnDescription === 'void';
  const isAsyncVoid = tool.returnDescription === 'Promise<void>';
  const isPromise = tool.returnDescription.startsWith('Promise<');
  const callExpr = `${objectExpr}.${method}(${methodArgs})`;

  if (isSyncVoid) {
    return `${prefix}${callExpr};\n      return { ok: true };`;
  }

  if (isAsyncVoid) {
    return `${prefix}await ${callExpr};\n      return { ok: true };`;
  }

  if (isPromise) {
    return `${prefix}const _result = await ${callExpr};\n      return serializeResult(_result);`;
  }

  // Sync return value (non-Promise) — rare in the SDK but handled for robustness
  return `${prefix}const _result = ${callExpr};\n      return serializeResult(_result);`;
}

function getTypecast(schemaType: string): string {
  switch (schemaType) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'unknown[]';
    default:
      return 'unknown';
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const isCliEntry =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  void main();
}
