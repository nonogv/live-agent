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
  // Declare browser-like globals at the very top of the CJS bundle file.
  // In a single-file CJS bundle every nested function sees top-level `var`
  // declarations via closure, so this reliably shadows the missing sandbox
  // globals without depending on `globalThis` being writable or any lazy
  // initialiser ordering.
  banner: {
    js: [
      `var _nu = require("url");`,
      `var URL = (typeof URL !== "undefined") ? URL : _nu.URL;`,
      `var URLSearchParams = (typeof URLSearchParams !== "undefined") ? URLSearchParams : _nu.URLSearchParams;`,
      `try { var _und = require("undici"); if (typeof fetch === "undefined") { var fetch = _und.fetch; var Headers = _und.Headers; var Request = _und.Request; var Response = _und.Response; } } catch(_e) {}`,
    ].join("\n"),
  },
  define: {
    "global": "globalThis",
    "import.meta.url": JSON.stringify(`file://${path.resolve(outfile)}`),
  },
});
