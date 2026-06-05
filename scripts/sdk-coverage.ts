/**
 * SDK completeness audit — compares public SDK members against generated tools
 * and documents which readable properties must appear in getLiveState().
 */

import { Project } from 'ts-morph';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TARGET_CLASSES,
  EXCLUDED_SDK_CLASSES,
  EXCLUDED_SDK_MEMBERS,
  discoverToolsFromSdk,
  toSnakeCase,
  type GeneratedTool,
} from './generate-tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SDK_TYPES = path.join(ROOT, 'node_modules/@ableton-extensions/sdk/dist/index.d.mts');

/** Custom tools in src/agent/tools.ts that intentionally replace or augment SDK calls. */
export const CUSTOM_TOOL_NAMES = ['get_live_state'] as const;

/**
 * SDK getter properties that getLiveState() must surface (class → property names).
 */
export const LIVE_STATE_SDK_GETTERS: Record<string, readonly string[]> = {
  Song: [
    'tempo',
    'rootNote',
    'scaleName',
    'scaleMode',
    'scaleIntervals',
    'gridQuantization',
    'gridIsTriplet',
    'tracks',
    'returnTracks',
    'mainTrack',
    'scenes',
    'cuePoints',
  ],
  Track: [
    'name',
    'mute',
    'solo',
    'mutedViaSolo',
    'arm',
    'groupTrack',
    'devices',
    'mixer',
    'clipSlots',
    'arrangementClips',
    'takeLanes',
  ],
  Clip: [
    'name',
    'startTime',
    'endTime',
    'duration',
    'startMarker',
    'endMarker',
    'looping',
    'loopStart',
    'loopEnd',
    'color',
    'muted',
  ],
  AudioClip: ['filePath', 'warping', 'warpMode', 'warpMarkers'],
  MidiClip: ['notes'],
  Scene: ['name', 'tempo', 'signatureNumerator', 'signatureDenominator'],
  CuePoint: ['name', 'time'],
  Device: ['name', 'parameters'],
  DeviceParameter: ['name', 'min', 'max', 'isQuantized', 'defaultValue', 'valueItems'],
  TakeLane: ['name', 'clips'],
  Chain: ['devices'],
  DrumChain: ['receivingNote'],
  RackDevice: ['chains'],
  Simpler: ['sample'],
};

/** Top-level keys on the LiveState interface (src/agent/chat.ts). */
export const LIVE_STATE_TOP_LEVEL_KEYS = [
  'tempo',
  'rootNote',
  'scaleName',
  'scaleMode',
  'scaleIntervals',
  'gridQuantization',
  'gridIsTriplet',
  'trackCount',
  'tracks',
  'mainTrack',
  'scenes',
  'cuePoints',
] as const;

export interface SdkMemberRef {
  className: string;
  kind: 'method' | 'setter';
  name: string;
  expectedTool: string;
}

export interface SdkCoverageReport {
  sdkMembers: SdkMemberRef[];
  generatedToolNames: string[];
  customToolNames: readonly string[];
  missingTools: SdkMemberRef[];
  extraGeneratedTools: string[];
  excludedClasses: Record<string, string>;
  excludedMembers: Record<string, string>;
}

/** Lists every public SDK method and setter on TARGET_CLASSES. */
export function listTargetSdkMembers(): SdkMemberRef[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(SDK_TYPES);
  const members: SdkMemberRef[] = [];

  for (const className of TARGET_CLASSES) {
    const cls = sourceFile.getClass(className);
    if (!cls) continue;

    for (const method of cls.getMethods()) {
      if (method.hasModifier('private') || method.hasModifier('protected')) continue;
      const name = method.getName();
      if (['constructor', 'toString', 'valueOf'].includes(name)) continue;
      members.push({
        className,
        kind: 'method',
        name,
        expectedTool: toSnakeCase(`${className}_${name}`),
      });
    }

    for (const setter of cls.getSetAccessors()) {
      if (setter.hasModifier('private') || setter.hasModifier('protected')) continue;
      members.push({
        className,
        kind: 'setter',
        name: setter.getName(),
        expectedTool: toSnakeCase(`${className}_set_${setter.getName()}`),
      });
    }
  }

  return members;
}

/** Compares discovered SDK tools against the generated tool name list. */
export function auditSdkToolCoverage(generatedToolNames: string[]): SdkCoverageReport {
  const discovered = discoverToolsFromSdk();
  const discoveredNames = new Set(discovered.map((t) => t.name));

  const sdkMembers = listTargetSdkMembers();
  const missingTools = sdkMembers.filter((m) => {
    const key = `${m.className}.${m.kind === 'setter' ? `set ${m.name}` : m.name}`;
    if (key in EXCLUDED_SDK_MEMBERS) return false;
    return !discoveredNames.has(m.expectedTool);
  });

  const expectedNames = new Set([...discovered.map((t) => t.name), ...CUSTOM_TOOL_NAMES]);
  const extraGeneratedTools = generatedToolNames.filter((n) => !expectedNames.has(n));

  return {
    sdkMembers,
    generatedToolNames,
    customToolNames: CUSTOM_TOOL_NAMES,
    missingTools,
    extraGeneratedTools,
    excludedClasses: EXCLUDED_SDK_CLASSES,
    excludedMembers: EXCLUDED_SDK_MEMBERS,
  };
}

/** Returns SDK class names with public API not in TARGET_CLASSES or EXCLUDED_SDK_CLASSES. */
export function findUndocumentedSdkClasses(): string[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(SDK_TYPES);
  const targetSet = new Set<string>(TARGET_CLASSES);
  const undocumented: string[] = [];

  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (!name || name.endsWith('Registry')) continue;
    if (targetSet.has(name)) continue;
    if (name in EXCLUDED_SDK_CLASSES) continue;

    const hasPublicApi =
      cls.getMethods().some((m) => !m.hasModifier('private') && !m.hasModifier('protected')) ||
      cls.getSetAccessors().some((s) => !s.hasModifier('private') && !s.hasModifier('protected')) ||
      cls.getGetAccessors().some((g) => !g.hasModifier('private') && !g.hasModifier('protected'));

    if (hasPublicApi) undocumented.push(name);
  }

  return undocumented.sort();
}

/** Summarises tool discovery for console output during `npm run generate`. */
export function formatCoverageSummary(tools: GeneratedTool[]): string {
  const names = tools.map((t) => t.name);
  const report = auditSdkToolCoverage(names);
  const lines = [
    `SDK tool coverage: ${names.length} generated, ${report.missingTools.length} gaps`,
  ];
  if (report.missingTools.length > 0) {
    for (const gap of report.missingTools) {
      lines.push(`  ✗ missing: ${gap.className}.${gap.name} → ${gap.expectedTool}`);
    }
  }
  const undocumented = findUndocumentedSdkClasses();
  if (undocumented.length > 0) {
    lines.push(`  ⚠ undocumented SDK classes: ${undocumented.join(', ')}`);
  }
  return lines.join('\n');
}
