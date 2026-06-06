import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Song } from '@ableton-extensions/sdk';
import {
  attachLiveSnapshotIfNeeded,
  buildCompactSnapshot,
  enrichToolErrorMessage,
  TRACK_LAYOUT_TOOLS,
} from './live-snapshot.js';

vi.mock('../live/executor.js', () => ({
  getLiveState: vi.fn(),
}));

import { getLiveState } from '../live/executor.js';

const mockSong = {} as Song<'1.0.0'>;

describe('enrichToolErrorMessage', () => {
  it('explains the last-track constraint for generic delete failures', () => {
    const message = enrichToolErrorMessage('Failed to delete track');
    expect(message).toContain('at least one track');
  });

  it('passes through unrelated errors unchanged', () => {
    expect(enrichToolErrorMessage('Device not found')).toBe('Device not found');
  });
});

describe('buildCompactSnapshot', () => {
  beforeEach(() => {
    vi.mocked(getLiveState).mockResolvedValue({
      tempo: 40,
      tracks: [
        { id: 'track-a', name: 'Drums', type: 'midi' },
        { id: 'track-b', name: 'Bass', type: 'midi' },
      ],
    } as Awaited<ReturnType<typeof getLiveState>>);
  });

  it('returns tempo and track ids', async () => {
    const snapshot = await buildCompactSnapshot(mockSong);
    expect(snapshot).toEqual({
      tempo: 40,
      tracks: [
        { id: 'track-a', name: 'Drums', type: 'midi' },
        { id: 'track-b', name: 'Bass', type: 'midi' },
      ],
    });
  });
});

describe('attachLiveSnapshotIfNeeded', () => {
  beforeEach(() => {
    vi.mocked(getLiveState).mockResolvedValue({
      tempo: 120,
      tracks: [{ id: 'only-track', name: '1-MIDI', type: 'midi' }],
    } as Awaited<ReturnType<typeof getLiveState>>);
  });

  it('attaches liveSnapshot after track layout tools', async () => {
    for (const toolName of TRACK_LAYOUT_TOOLS) {
      const result = await attachLiveSnapshotIfNeeded(mockSong, toolName, { ok: true });
      expect(result).toMatchObject({
        ok: true,
        liveSnapshot: { tempo: 120, tracks: [{ id: 'only-track', name: '1-MIDI', type: 'midi' }] },
      });
    }
  });

  it('enriches delete failures and attaches liveSnapshot', async () => {
    const result = await attachLiveSnapshotIfNeeded(mockSong, 'song_delete_track', {
      ok: false,
      error: 'Failed to delete track',
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('at least one track'),
      liveSnapshot: { tempo: 120, tracks: [{ id: 'only-track', name: '1-MIDI', type: 'midi' }] },
    });
  });

  it('attaches liveSnapshot when a track id is stale', async () => {
    const result = await attachLiveSnapshotIfNeeded(mockSong, 'track_set_name', {
      ok: false,
      error: 'Track "123" not found. Call song_get_tracks to refresh.',
    });

    expect(result).toMatchObject({
      liveSnapshot: { tempo: 120, tracks: [{ id: 'only-track', name: '1-MIDI', type: 'midi' }] },
    });
  });

  it('leaves unrelated successful tools unchanged', async () => {
    vi.mocked(getLiveState).mockClear();
    const result = await attachLiveSnapshotIfNeeded(mockSong, 'song_set_tempo', { ok: true });
    expect(result).toEqual({ ok: true });
    expect(getLiveState).not.toHaveBeenCalled();
  });
});
