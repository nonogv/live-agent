import { describe, it, expect, vi } from 'vitest';
import { createModalGuard } from './modal-guard.js';

describe('createModalGuard', () => {
  it('ignores duplicate open requests while a dialog is open', async () => {
    const guard = createModalGuard();
    let resolveOpen!: () => void;
    const openFn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveOpen = resolve;
        }),
    );

    const first = guard.open(openFn);
    expect(guard.isOpen()).toBe(true);

    await guard.open(openFn);
    expect(openFn).toHaveBeenCalledTimes(1);

    resolveOpen();
    await first;
    expect(guard.isOpen()).toBe(false);
  });

  it('allows a new open after the previous dialog closes', async () => {
    const guard = createModalGuard();
    const openFn = vi.fn(async () => undefined);

    await guard.open(openFn);
    await guard.open(openFn);

    expect(openFn).toHaveBeenCalledTimes(2);
    expect(guard.isOpen()).toBe(false);
  });

  it('clears in-flight state when openFn rejects', async () => {
    const guard = createModalGuard();
    const openFn = vi.fn(async () => {
      throw new Error('dialog failed');
    });

    await guard.open(openFn);
    expect(guard.isOpen()).toBe(false);

    await guard.open(openFn);
    expect(openFn).toHaveBeenCalledTimes(2);
  });
});
