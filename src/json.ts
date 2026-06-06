/**
 * Returns true when `value` looks like an Ableton Live object with a handle id.
 */
function isLiveHandleObject(value: object): value is { handle: { id: unknown }; name?: unknown } {
  if (!('handle' in value)) return false;
  const handle = (value as { handle: unknown }).handle;
  return typeof handle === 'object' && handle !== null && 'id' in handle;
}

/**
 * Recursively converts a value to a JSON-serializable form.
 * BigInts become decimal strings; Live handle objects become `{ id, name? }`.
 */
export function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => toJsonSafe(item));

  if (isLiveHandleObject(value)) {
    const handleId = value.handle.id;
    const id =
      typeof handleId === 'bigint'
        ? handleId.toString()
        : typeof handleId === 'number' || typeof handleId === 'string'
          ? String(handleId)
          : toJsonSafe(handleId);
    return {
      id,
      ...(typeof value.name === 'string' ? { name: value.name } : {}),
    };
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = toJsonSafe(entry);
  }
  return result;
}

/**
 * JSON.stringify wrapper that supports BigInt values and Live handle objects.
 */
export function stringifyJson(value: unknown): string {
  return JSON.stringify(toJsonSafe(value));
}
