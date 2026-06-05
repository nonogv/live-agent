import { describe, it, expect } from 'vitest';
import type { ServerMessage } from './types';

/** Type guard for the turn_committed server message. */
export function isTurnCommitted(msg: ServerMessage): msg is { type: 'turn_committed' } {
  return msg.type === 'turn_committed';
}

describe('ServerMessage turn_committed', () => {
  it('is recognized as a turn_committed message', () => {
    const msg: ServerMessage = { type: 'turn_committed' };
    expect(isTurnCommitted(msg)).toBe(true);
  });
});
