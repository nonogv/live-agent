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

import { Project, ClassDeclaration, MethodDeclaration, ParameterDeclaration, Type } from "ts-morph";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SDK_TYPES = path.join(ROOT, "node_modules/@ableton-extensions/sdk/dist/index.d.mts");
const OUT_TOOLS = path.join(ROOT, "src/agent/generated-tools.ts");
const OUT_EXECUTOR = path.join(ROOT, "src/live/generated-executor.ts");

// ─── SDK object class names — these become handle-id references in tool params ─
const SDK_OBJECT_CLASSES = new Set([
  "Track", "MidiTrack", "AudioTrack",
  "Clip", "MidiClip", "AudioClip",
  "ClipSlot",
  "Scene",
  "Device",
  "DeviceParameter",
  "Simpler", "Sample",
  "TakeLane",
  "Chain", "DrumChain", "RackDevice", "DrumRack",
  "CuePoint",
  "DataModelObject",
]);

// ─── Classes to extract tools from (in order) ────────────────────────────────
const TARGET_CLASSES = [
  "Song",
  "Track",
  "MidiTrack",
  "AudioTrack",
  "ClipSlot",
  "Clip",
  "MidiClip",
  "AudioClip",
  "Scene",
  "Device",
  "DeviceParameter",
  "Simpler",
  "TakeLane",
];

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
  name: string;        // parameter name in the tool schema
  originalName: string;
  schema: JsonSchemaProperty;
  required: boolean;
  isHandleRef: boolean; // true if this replaces an SDK object reference
  handleClass: string;  // e.g. "Track"
}

interface GeneratedTool {
  name: string;        // e.g. song_createMidiTrack
  description: string;
  targetClass: string; // e.g. "Song"
  method: string;      // e.g. "createMidiTrack"
  params: ToolParam[];
  returnDescription: string;
  hasContext: boolean; // needs additional context (track_id to find ClipSlot, etc.)
  contextParams: ToolParam[]; // e.g. track_id to locate the object
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log("Reading SDK types from", SDK_TYPES);

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
  }

  // Also extract settable properties as set_* tools
  for (const targetClassName of TARGET_CLASSES) {
    const cls = sourceFile.getClass(targetClassName);
    if (!cls) continue;
    const setters = extractSetters(cls, targetClassName);
    tools.push(...setters);
    if (setters.length > 0) {
      console.log(`  ✓ ${targetClassName}: ${setters.length} setter tools`);
    }
  }

  console.log(`\nTotal tools generated: ${tools.length}`);

  writeToolSchemas(tools);
  writeExecutor(tools);

  console.log("\nGenerated:");
  console.log(" ", OUT_TOOLS);
  console.log(" ", OUT_EXECUTOR);
}

// ─── Method extraction ────────────────────────────────────────────────────────

function extractMethods(cls: ClassDeclaration, className: string): GeneratedTool[] {
  const tools: GeneratedTool[] = [];

  for (const method of cls.getMethods()) {
    // Skip private, internal, constructor helpers
    if (method.hasModifier("private") || method.hasModifier("protected")) continue;

    const name = method.getName();

    // Skip methods inherited from DataModelObject that are unrelated to Live control
    if (["constructor", "toString", "valueOf"].includes(name)) continue;

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
    if (setter.hasModifier("private") || setter.hasModifier("protected")) continue;

    const propName = setter.getName();
    const jsDoc = getJsDoc(setter);
    const paramType = setter.getParameters()[0]?.getType();
    if (!paramType) continue;

    const schema = typeToJsonSchema(paramType, propName, className);
    if (!schema) continue;

    const toolName = toSnakeCase(`${className}_set_${propName}`);
    const contextParams = getContextParams(className);

    const valueParam: ToolParam = {
      name: "value",
      originalName: "value",
      schema: { ...schema, description: schema.description || `New value for ${propName}.` },
      required: true,
      isHandleRef: false,
      handleClass: "",
    };

    tools.push({
      name: toolName,
      description: jsDoc || `Sets the ${propName} property on ${className}.`,
      targetClass: className,
      method: `set ${propName}`,
      params: [valueParam],
      returnDescription: "void",
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
    if (typeName.includes("=>") || typeName.includes("callback")) continue;

    // Check if this is an SDK object reference — use symbol name (resolves generics correctly)
    const sdkClass = getSdkClassName(type) ?? findSdkClass(typeName);
    if (sdkClass) {
      result.push({
        name: `${paramName}_id`,
        originalName: paramName,
        schema: {
          type: "string",
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
          type: "object",
          description: `Configuration object for ${method.getName()}.`,
          properties: inlineProps,
          required,
        },
        required: !param.isOptional(),
        isHandleRef: false,
        handleClass: "",
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
      handleClass: "",
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
  contextClass: string
): JsonSchemaProperty | null {
  const text = type.getText();

  // Unwrap Promise<T>
  if (text.startsWith("Promise<")) {
    const inner = type.getTypeArguments()[0];
    if (inner) return typeToJsonSchema(inner, paramName, contextClass);
  }

  // Unwrap T | undefined
  if (type.isUnion()) {
    const nonUndefined = type.getUnionTypes().filter((t) => !t.isUndefined());
    if (nonUndefined.length === 1) return typeToJsonSchema(nonUndefined[0], paramName, contextClass);
  }

  if (type.isString() || text === "string") return { type: "string", description: "" };
  if (type.isNumber() || text === "number") return { type: "number", description: "" };
  if (type.isBoolean() || text === "boolean") return { type: "boolean", description: "" };
  if (type.isNull() || type.isUndefined() || type.isVoid()) return { type: "null", description: "" };

  // Enum
  if (type.isEnum() || type.isEnumLiteral()) {
    return {
      type: "string",
      description: `Enum value. One of: ${type.getText()}`,
    };
  }

  // Literal union (e.g. "beats" | "tones")
  if (type.isUnion()) {
    const members = type.getUnionTypes();
    if (members.every((m) => m.isStringLiteral())) {
      return {
        type: "string",
        description: "",
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
        return { type: "array", description: "", items };
      }
    }
  }

  // NoteDescription
  if (text.includes("NoteDescription")) {
    return {
      type: "object",
      description: "A MIDI note.",
      properties: {
        pitch: { type: "number", description: "MIDI note number (0–127)." },
        startTime: { type: "number", description: "Start time in beats." },
        duration: { type: "number", description: "Duration in beats." },
        velocity: { type: "number", description: "Velocity (0–127). Default: 100." },
        muted: { type: "boolean", description: "Whether the note is muted." },
        probability: { type: "number", description: "Note probability (0–1)." },
      },
      required: ["pitch", "startTime", "duration"],
    };
  }

  // SDK object types — replace with handle ID
  const sdkClass = getSdkClassName(type) ?? findSdkClass(text);
  if (sdkClass) {
    return {
      type: "string",
      description: `Handle ID of the ${sdkClass}.`,
    };
  }

  // bigint
  if (text === "bigint") return { type: "number", description: "" };

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
    case "ClipSlot":
      return [
        {
          name: "track_id",
          originalName: "track_id",
          schema: { type: "string", description: "Handle ID of the track containing this clip slot." },
          required: true,
          isHandleRef: true,
          handleClass: "Track",
        },
        {
          name: "slot_index",
          originalName: "slot_index",
          schema: { type: "number", description: "0-based index of the clip slot on the track." },
          required: true,
          isHandleRef: false,
          handleClass: "",
        },
      ];
    case "TakeLane":
      return [
        {
          name: "take_lane_id",
          originalName: "take_lane_id",
          schema: { type: "string", description: "Handle ID of the take lane." },
          required: true,
          isHandleRef: true,
          handleClass: "TakeLane",
        },
      ];
    case "Track":
    case "MidiTrack":
    case "AudioTrack":
    case "Clip":
    case "MidiClip":
    case "AudioClip":
    case "Scene":
    case "Device":
    case "DeviceParameter":
    case "Simpler":
      return [
        {
          name: `${toSnakeCase(className)}_id`,
          originalName: `${toSnakeCase(className)}_id`,
          schema: {
            type: "string",
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

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/__+/g, "_");
}

function getJsDoc(node: MethodDeclaration | ReturnType<ClassDeclaration["getSetAccessors"]>[0]): string {
  const docs = node.getJsDocs();
  if (docs.length === 0) return "";
  return docs
    .map((d) => d.getDescription().trim())
    .join(" ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function describeReturn(method: MethodDeclaration): string {
  const ret = method.getReturnType().getText();
  if (ret.startsWith("Promise<")) {
    const inner = ret.slice(8, -1);
    return inner === "void" ? "void" : `Promise<${inner}>`;
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
    lines.push(`      properties: ${JSON.stringify(properties, null, 6).split("\n").join("\n      ")},`);
    if (required.length > 0) {
      lines.push(`      required: ${JSON.stringify(required)},`);
    }
    lines.push(`    },`);
    lines.push(`  },`);
  }

  lines.push(`];`);
  lines.push(``);

  fs.writeFileSync(OUT_TOOLS, lines.join("\n"), "utf-8");
}

// ─── Output: Executor ─────────────────────────────────────────────────────────

function writeExecutor(tools: GeneratedTool[]) {
  const lines: string[] = [
    `// AUTO-GENERATED by scripts/generate-tools.ts — DO NOT EDIT MANUALLY`,
    `// Run \`npm run generate\` to regenerate from the current SDK types.`,
    `// Generated at: ${new Date().toISOString()}`,
    ``,
    `import {`,
    `  MidiTrack, AudioTrack, MidiClip, AudioClip, ClipSlot, Device, DeviceParameter, Simpler, TakeLane,`,
    `  type Song,`,
    `} from "@ableton-extensions/sdk";`,
    ``,
    `// ─── Object finders ────────────────────────────────────────────────────────`,
    ``,
    `function findTrack(song: Song<"1.0.0">, id: string) {`,
    `  const t = song.tracks.find(t => t.handle.id.toString() === id);`,
    `  if (!t) throw new Error(\`Track "\${id}" not found. Call song_get_tracks to refresh.\`);`,
    `  return t;`,
    `}`,
    ``,
    `function findScene(song: Song<"1.0.0">, id: string) {`,
    `  const s = song.scenes.find(s => s.handle.id.toString() === id);`,
    `  if (!s) throw new Error(\`Scene "\${id}" not found.\`);`,
    `  return s;`,
    `}`,
    ``,
    `function findClip(song: Song<"1.0.0">, id: string) {`,
    `  for (const track of song.tracks) {`,
    `    for (const slot of track.clipSlots) {`,
    `      if (slot.clip?.handle.id.toString() === id) return slot.clip;`,
    `    }`,
    `    for (const clip of track.arrangementClips) {`,
    `      if (clip.handle.id.toString() === id) return clip;`,
    `    }`,
    `  }`,
    `  throw new Error(\`Clip "\${id}" not found.\`);`,
    `}`,
    ``,
    `function findDevice(song: Song<"1.0.0">, id: string) {`,
    `  for (const track of [...song.tracks, ...song.returnTracks]) {`,
    `    for (const device of track.devices) {`,
    `      if (device.handle.id.toString() === id) return device;`,
    `    }`,
    `  }`,
    `  throw new Error(\`Device "\${id}" not found.\`);`,
    `}`,
    ``,
    `function findDeviceParameter(song: Song<"1.0.0">, id: string) {`,
    `  for (const track of [...song.tracks, ...song.returnTracks]) {`,
    `    for (const device of track.devices) {`,
    `      for (const param of device.parameters) {`,
    `        if (param.handle.id.toString() === id) return param;`,
    `      }`,
    `    }`,
    `  }`,
    `  throw new Error(\`DeviceParameter "\${id}" not found.\`);`,
    `}`,
    ``,
    `function findTakeLane(song: Song<"1.0.0">, id: string) {`,
    `  for (const track of song.tracks) {`,
    `    for (const lane of track.takeLanes) {`,
    `      if (lane.handle.id.toString() === id) return lane;`,
    `    }`,
    `  }`,
    `  throw new Error(\`TakeLane "\${id}" not found.\`);`,
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
    `function findByHandleClass(song: Song<"1.0.0">, cls: string, id: string): unknown {`,
    `  switch (cls) {`,
    `    case "Track": case "MidiTrack": case "AudioTrack": return findTrack(song, id);`,
    `    case "Scene": return findScene(song, id);`,
    `    case "Clip": case "MidiClip": case "AudioClip": return findClip(song, id);`,
    `    case "Device": return findDevice(song, id);`,
    `    case "DeviceParameter": return findDeviceParameter(song, id);`,
    `    case "TakeLane": return findTakeLane(song, id);`,
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

  fs.writeFileSync(OUT_EXECUTOR, lines.join("\n"), "utf-8");
}

function generateDispatchBody(tool: GeneratedTool): string {
  const { targetClass, method, params, contextParams } = tool;
  const a = "args";

  // Resolve the target object
  let objectExpr = "";
  let prefix = "";

  switch (targetClass) {
    case "Song":
      objectExpr = "song";
      break;
    case "Track": {
      const idParam = contextParams[0];
      prefix = `const _obj = findTrack(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      `;
      objectExpr = "_obj";
      break;
    }
    case "MidiTrack": {
      const idParam = contextParams[0];
      prefix = `const _baseTrack = findTrack(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      if (!(_baseTrack instanceof MidiTrack)) throw new Error("Track is not a MIDI track.");\n      const _obj = _baseTrack;\n      `;
      objectExpr = "_obj";
      break;
    }
    case "AudioTrack": {
      const idParam = contextParams[0];
      prefix = `const _baseTrack = findTrack(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      if (!(_baseTrack instanceof AudioTrack)) throw new Error("Track is not an Audio track.");\n      const _obj = _baseTrack;\n      `;
      objectExpr = "_obj";
      break;
    }
    case "ClipSlot": {
      prefix = [
        `const _track = findTrack(song, ${a}["track_id"] as string);`,
        `const _slotIdx = ${a}["slot_index"] as number;`,
        `const _obj = _track.clipSlots[_slotIdx];`,
        `if (!_obj) throw new Error(\`ClipSlot \${_slotIdx} not found.\`);`,
      ].join("\n      ") + "\n      ";
      objectExpr = "_obj";
      break;
    }
    case "Clip": {
      const idParam = contextParams[0];
      prefix = `const _obj = findClip(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      `;
      objectExpr = "_obj";
      break;
    }
    case "MidiClip": {
      const idParam = contextParams[0];
      prefix = `const _baseClip = findClip(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      if (!(_baseClip instanceof MidiClip)) throw new Error("Clip is not a MIDI clip.");\n      const _obj = _baseClip;\n      `;
      objectExpr = "_obj";
      break;
    }
    case "AudioClip": {
      const idParam = contextParams[0];
      prefix = `const _baseClip = findClip(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      if (!(_baseClip instanceof AudioClip)) throw new Error("Clip is not an Audio clip.");\n      const _obj = _baseClip;\n      `;
      objectExpr = "_obj";
      break;
    }
    case "Scene": {
      const idParam = contextParams[0];
      prefix = `const _obj = findScene(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      `;
      objectExpr = "_obj";
      break;
    }
    case "Device": {
      const idParam = contextParams[0];
      prefix = `const _obj = findDevice(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      `;
      objectExpr = "_obj";
      break;
    }
    case "DeviceParameter": {
      const idParam = contextParams[0];
      prefix = `const _obj = findDeviceParameter(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      `;
      objectExpr = "_obj";
      break;
    }
    case "Simpler": {
      const idParam = contextParams[0];
      prefix = `const _rawDevice = findDevice(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      if (!(_rawDevice instanceof Simpler)) throw new Error("Device is not a Simpler");\n      const _obj = _rawDevice;\n      `;
      objectExpr = "_obj";
      break;
    }
    case "TakeLane": {
      const idParam = contextParams[0];
      prefix = `const _obj = findTakeLane(song, ${a}[${JSON.stringify(idParam.name)}] as string);\n      `;
      objectExpr = "_obj";
      break;
    }
    default:
      return `throw new Error("Unimplemented target class: ${targetClass}");`;
  }

  // Build the method call
  if (method.startsWith("set ")) {
    const propName = method.slice(4);
    const valParam = params[0];
    // Always cast as `never` — the SDK type is correct at runtime; this is just a generator escape hatch
    const valExpr = valParam ? `${a}[${JSON.stringify(valParam.name)}] as never` : "undefined as never";
    return `${prefix}${objectExpr}.${propName} = ${valExpr};\n      return { ok: true };`;
  }

    const methodArgs = params
    .map((p) => {
      if (p.isHandleRef) {
        // Resolve the handle and cast to the expected type
        return `findByHandleClass(song, "${p.handleClass}", ${a}[${JSON.stringify(p.name)}] as string) as never`;
      }
      const cast = p.schema.type === "object" ? "never" : getTypecast(p.schema.type);
      return `${a}[${JSON.stringify(p.name)}] as ${cast}`;
    })
    .join(", ");

  const isAsync = tool.returnDescription !== "void" && !tool.returnDescription.startsWith("void");
  const callExpr = `${objectExpr}.${method}(${methodArgs})`;

  if (tool.returnDescription === "void" || tool.returnDescription.includes("void")) {
    return `${prefix}${callExpr};\n      return { ok: true };`;
  }

  return `${prefix}const _result = await ${callExpr};\n      return serializeResult(_result);`;
}

function getTypecast(schemaType: string): string {
  switch (schemaType) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "array": return "unknown[]";
    default: return "unknown";
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main();
