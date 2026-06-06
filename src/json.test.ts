import { describe, expect, it } from 'vitest';
import { stringifyJson, toJsonSafe } from './json.js';

describe('toJsonSafe', () => {
  it('converts bigint scalars to decimal strings', () => {
    expect(toJsonSafe(42n)).toBe('42');
  });

  it('converts Live handle objects to id/name records', () => {
    expect(
      toJsonSafe({
        handle: { id: 9999999999999999999999999999999999999999n },
        name: 'Kick',
      }),
    ).toEqual({
      id: '9999999999999999999999999999999999999999',
      name: 'Kick',
    });
  });

  it('walks nested structures', () => {
    expect(
      toJsonSafe({
        tempo: 120,
        tracks: [{ handle: { id: 123n }, name: 'Drums' }],
        color: 7n,
      }),
    ).toEqual({
      tempo: 120,
      tracks: [{ id: '123', name: 'Drums' }],
      color: '7',
    });
  });
});

describe('stringifyJson', () => {
  it('serializes values that JSON.stringify rejects', () => {
    expect(stringifyJson({ id: 1n, nested: [{ handle: { id: 2n } }] })).toBe(
      '{"id":"1","nested":[{"id":"2"}]}',
    );
  });
});
