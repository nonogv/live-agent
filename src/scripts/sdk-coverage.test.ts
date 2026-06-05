import { describe, it, expect } from 'vitest';
import { GENERATED_TOOL_SCHEMAS } from '../agent/generated-tools.js';
import { discoverToolsFromSdk } from '../../scripts/generate-tools.js';
import {
  auditSdkToolCoverage,
  findUndocumentedSdkClasses,
  LIVE_STATE_TOP_LEVEL_KEYS,
  LIVE_STATE_SDK_GETTERS,
} from '../../scripts/sdk-coverage.js';
import type { LiveState } from '../agent/chat.js';

describe('SDK tool coverage', () => {
  it('generates a tool for every public SDK method/setter on TARGET_CLASSES', () => {
    const generatedNames = GENERATED_TOOL_SCHEMAS.map((t) => t.name);
    const discovered = discoverToolsFromSdk();

    expect(generatedNames.length).toBe(discovered.length);

    const report = auditSdkToolCoverage(generatedNames);
    expect(report.missingTools, formatMissing(report.missingTools)).toEqual([]);
  });

  it('documents every non-target SDK class with public API', () => {
    const undocumented = findUndocumentedSdkClasses();
    expect(
      undocumented,
      `Add to TARGET_CLASSES or EXCLUDED_SDK_CLASSES: ${undocumented.join(', ')}`,
    ).toEqual([]);
  });

  it('includes drum_chain_set_receiving_note for DrumChain', () => {
    const names = GENERATED_TOOL_SCHEMAS.map((t) => t.name);
    expect(names).toContain('drum_chain_set_receiving_note');
  });
});

describe('LiveState coverage', () => {
  it('LiveState includes all top-level readable Song fields', () => {
    const keys = LIVE_STATE_TOP_LEVEL_KEYS satisfies readonly (keyof LiveState)[];
    for (const key of keys) {
      expect(key satisfies keyof LiveState).toBeTruthy();
    }
  });

  it('documents getters for every SDK class surfaced in get_live_state', () => {
    expect(LIVE_STATE_SDK_GETTERS.Song).toContain('gridQuantization');
    expect(LIVE_STATE_SDK_GETTERS.Track).toContain('mutedViaSolo');
    expect(LIVE_STATE_SDK_GETTERS.AudioClip).toContain('warpMarkers');
    expect(LIVE_STATE_SDK_GETTERS.DrumChain).toContain('receivingNote');
  });
});

function formatMissing(missing: ReturnType<typeof auditSdkToolCoverage>['missingTools']): string {
  return missing.map((m) => `${m.className}.${m.name} → ${m.expectedTool}`).join('\n');
}
