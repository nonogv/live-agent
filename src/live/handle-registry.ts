/**
 * Float64-to-exact-string handle registry.
 *
 * Ableton Live object handles are BigInts that can be 40+ decimal digits long.
 * When the LLM emits such a handle as a JSON number (instead of a quoted string),
 * JSON.parse silently rounds it to the nearest float64, discarding the last ~28
 * significant digits. This makes it impossible to match the handle against any
 * real Live object.
 *
 * The fix: every time getLiveState() builds the session snapshot it registers
 * each handle here. Registration maps  Number(handleStr) → handleStr, i.e.
 * float64(handle) → exact string. Then parseHandleArg() can recover the original
 * value via float equality — the LLM's rounded float and our stored key are
 * guaranteed to be exactly the same float64.
 */

const floatToHandle = new Map<number, string>();

/**
 * Register a handle string. Returns the string unchanged so it can be used
 * inline: `id: reg(handle.id.toString())`.
 */
export function reg(s: string): string {
  floatToHandle.set(Number(s), s);
  return s;
}

/**
 * Resolve a handle value that may have lost precision to the exact registered
 * string. Returns null if the value isn't in the registry.
 */
export function resolveHandle(s: string | number): string | null {
  const key = typeof s === 'number' ? s : Number(s);
  if (Number.isNaN(key)) return null;
  return floatToHandle.get(key) ?? null;
}

/** Clear all registered handles. Called at the top of getLiveState(). */
export function clearRegistry(): void {
  floatToHandle.clear();
}
