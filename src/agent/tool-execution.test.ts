import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Song } from '@ableton-extensions/sdk';
import { formatToolError, executeToolWithRecovery } from './tool-execution.js';

vi.mock('../live/generated-executor.js', () => ({
  executeGeneratedTool: vi.fn(),
}));

vi.mock('../live/executor.js', () => ({
  handleToolCall: vi.fn(),
  getLiveState: vi.fn(),
}));

vi.mock('./live-snapshot.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./live-snapshot.js')>();
  return {
    ...actual,
    attachLiveSnapshotIfNeeded: vi.fn(async (_song, _name, result: unknown) => result),
  };
});

import { executeGeneratedTool } from '../live/generated-executor.js';
import { handleToolCall } from '../live/executor.js';

const mockSong = {} as Song<'1.0.0'>;
const mockContext = { getSong: () => mockSong };

describe('formatToolError', () => {
  it('extracts message from Error instances', () => {
    expect(formatToolError(new Error('Failed to delete track'))).toEqual({
      ok: false,
      error: 'Failed to delete track',
    });
  });

  it('stringifies non-Error values', () => {
    expect(formatToolError(42)).toEqual({ ok: false, error: '42' });
  });
});

describe('executeToolWithRecovery', () => {
  beforeEach(() => {
    vi.mocked(executeGeneratedTool).mockReset();
    vi.mocked(handleToolCall).mockReset();
  });

  it('returns successful generated tool results unchanged', async () => {
    vi.mocked(executeGeneratedTool).mockResolvedValue({ ok: true });

    const result = await executeToolWithRecovery(mockContext, 'song_set_tempo', { value: 120 });

    expect(result).toEqual({ ok: true });
    expect(handleToolCall).not.toHaveBeenCalled();
  });

  it('falls back to custom tools for unknown generated tools', async () => {
    vi.mocked(executeGeneratedTool).mockRejectedValue(
      new Error('Unknown generated tool: get_live_state'),
    );
    vi.mocked(handleToolCall).mockResolvedValue({ tempo: 120 });

    const result = await executeToolWithRecovery(mockContext, 'get_live_state', {});

    expect(result).toEqual({ tempo: 120 });
    expect(handleToolCall).toHaveBeenCalledWith(mockContext, 'get_live_state', {});
  });

  it('returns structured error for SDK failures instead of throwing', async () => {
    vi.mocked(executeGeneratedTool).mockRejectedValue(new Error('Failed to delete track'));

    const result = await executeToolWithRecovery(mockContext, 'song_delete_track', {
      track_id: '1',
    });

    expect(result).toEqual({ ok: false, error: 'Failed to delete track' });
  });

  it('returns structured error when custom tool fallback also fails', async () => {
    vi.mocked(executeGeneratedTool).mockRejectedValue(
      new Error('Unknown generated tool: get_live_state'),
    );
    vi.mocked(handleToolCall).mockRejectedValue(new Error('Song unavailable'));

    const result = await executeToolWithRecovery(mockContext, 'get_live_state', {});

    expect(result).toEqual({ ok: false, error: 'Song unavailable' });
  });
});
