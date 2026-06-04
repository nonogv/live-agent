/**
 * Tool names that mutate or delete Live objects and require confirmation in safe mode.
 * Autopilot mode bypasses these checks; safe mode (default) pauses for user confirmation.
 */
export const DESTRUCTIVE_TOOLS = new Set([
  'song_delete_track',
  'song_delete_scene',
  'song_delete_cue_point',
  'track_delete_device',
  'track_delete_clip',
  'track_clear_clips_in_range',
  'clip_slot_delete_clip',
]);
