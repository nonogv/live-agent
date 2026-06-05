import { describe, it, expect } from 'vitest';
import { parseHandleArg } from './generated-executor.js';

describe('parseHandleArg', () => {
  it('returns string ids unchanged', () => {
    expect(parseHandleArg('140425678901234567')).toBe('140425678901234567');
  });

  it('converts numeric ids that may have lost bigint precision', () => {
    expect(parseHandleArg(1.4042567890123456e23)).toBe(
      BigInt(Math.round(1.4042567890123456e23)).toString(),
    );
  });
});
