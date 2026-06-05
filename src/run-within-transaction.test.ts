import { describe, it, expect, vi } from 'vitest';
import { runWithinTransaction } from './run-within-transaction.js';

describe('runWithinTransaction', () => {
  it('invokes withinTransaction and returns the async result', async () => {
    const withinTransaction = vi.fn((cb: () => void) => {
      cb();
    });

    const result = await runWithinTransaction(withinTransaction, async () => 'ok');

    expect(withinTransaction).toHaveBeenCalledOnce();
    expect(result).toBe('ok');
  });

  it('rethrows errors from the async function', async () => {
    const withinTransaction = vi.fn((cb: () => void) => {
      cb();
    });
    const err = new Error('tool failed');

    await expect(
      runWithinTransaction(withinTransaction, async () => {
        throw err;
      }),
    ).rejects.toBe(err);
  });
});
