/**
 * Runs an async function from inside a synchronous `withinTransaction` callback.
 *
 * Live's `withinTransaction` requires a sync callback, so async tool work is
 * started inside the callback and awaited outside via a Promise bridge.
 */
export async function runWithinTransaction<T>(
  withinTransaction: (cb: () => void) => void,
  fn: () => Promise<T>,
): Promise<T> {
  let turnError: unknown = null;
  let value: T | undefined;

  await new Promise<void>((resolve) => {
    withinTransaction(() => {
      fn()
        .then((v) => {
          value = v;
          resolve();
        })
        .catch((e: unknown) => {
          turnError = e;
          resolve();
        });
    });
  });

  if (turnError) throw turnError;
  return value as T;
}
