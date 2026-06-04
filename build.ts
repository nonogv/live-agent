import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const production = process.argv.includes("--production");
const outfile: string = manifest.entry;
const outdir = path.dirname(outfile);

// Copy the static UI folder into the dist directory
const uiSrc = "src/ui";
const uiDest = path.join(outdir, "ui");
if (fs.existsSync(uiSrc)) {
  fs.cpSync(uiSrc, uiDest, { recursive: true, force: true });
}

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  outfile,
  bundle: true,
  format: "cjs",
  platform: "node",
  sourcesContent: false,
  logLevel: "info",
  minify: production,
  sourcemap: !production,
  // Externalize the SDK — provided by the Extension Host at runtime
  external: ["@ableton-extensions/sdk"],
  // esbuild outputs CJS so import.meta.url is unavailable; inject a
  // synthetic value so fileURLToPath() resolves __dirname correctly.
  // Polyfill globals missing from the Extension Host sandbox.
  // The sandbox strips modern Node globals; restore them from core modules.
  banner: {
    js: [
      `const _u = require('url');`,
      `if (typeof URL === 'undefined') { globalThis.URL = _u.URL; globalThis.URLSearchParams = _u.URLSearchParams; }`,
      `const _undici = (() => { try { return require('undici'); } catch(e) { return null; } })();`,
      `if (_undici && typeof fetch === 'undefined') { globalThis.fetch = _undici.fetch; globalThis.Headers = _undici.Headers; globalThis.Request = _undici.Request; globalThis.Response = _undici.Response; }`,
    ].join("\n"),
  },
  define: {
    "global": "globalThis",
    "import.meta.url": JSON.stringify(`file://${path.resolve(outfile)}`),
  },
});
