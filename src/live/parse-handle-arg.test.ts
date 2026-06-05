import { describe, it, expect, beforeEach } from 'vitest';
import { parseHandleArg } from './generated-executor.js';
import { reg, clearRegistry } from './handle-registry.js';

beforeEach(() => clearRegistry());

describe('parseHandleArg', () => {
  it('returns string ids unchanged when not in registry', () => {
    expect(parseHandleArg('140425678901234567')).toBe('140425678901234567');
  });

  it('resolves a numeric id to the exact registered string via float equality', () => {
    const exactStr = '140425678901234559352832';
    reg(exactStr); // register it (simulating getLiveState)
    const asFloat = Number(exactStr); // same float64 JSON.parse would produce
    expect(parseHandleArg(asFloat)).toBe(exactStr);
  });

  it('falls back to String(n) when the number is not in the registry', () => {
    const n = 1.4042567890123456e23;
    expect(parseHandleArg(n)).toBe(String(n));
  });
});
