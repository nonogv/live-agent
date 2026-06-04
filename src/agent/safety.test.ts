import { describe, it, expect } from 'vitest';
import { DESTRUCTIVE_TOOLS } from './safety.js';

describe('DESTRUCTIVE_TOOLS', () => {
  it('contains all expected destructive tool names', () => {
    const expected = [
      'song_delete_track',
      'song_delete_scene',
      'song_delete_cue_point',
      'track_delete_device',
      'track_delete_clip',
      'track_clear_clips_in_range',
      'clip_slot_delete_clip',
    ];
    for (const name of expected) {
      expect(DESTRUCTIVE_TOOLS.has(name), `expected ${name} to be destructive`).toBe(true);
    }
  });

  it('does not include safe read-only tools', () => {
    expect(DESTRUCTIVE_TOOLS.has('get_live_state')).toBe(false);
    expect(DESTRUCTIVE_TOOLS.has('song_create_midi_track')).toBe(false);
    expect(DESTRUCTIVE_TOOLS.has('track_set_name')).toBe(false);
  });

  it('is a Set', () => {
    expect(DESTRUCTIVE_TOOLS).toBeInstanceOf(Set);
  });
});
