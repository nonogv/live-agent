// Injected by esbuild into the bundle top-level.
// Named exports map to `define` substitutions (URL → __sandboxURL__, etc.).
// This runs before any other module code so the replacements are always live.

import { URL as __sandboxURL__, URLSearchParams as __sandboxUSP__ } from "url";

// Best-effort fetch polyfill – undici ships with Node 18+ as an internal.
// Silently ignored if unavailable in the Extension Host sandbox.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const undici = require("undici") as any;
  const g = globalThis as Record<string, unknown>;
  if (!g["fetch"])    g["fetch"]    = undici.fetch;
  if (!g["Headers"])  g["Headers"]  = undici.Headers;
  if (!g["Request"])  g["Request"]  = undici.Request;
  if (!g["Response"]) g["Response"] = undici.Response;
} catch (_) {}

export { __sandboxURL__, __sandboxUSP__ };
