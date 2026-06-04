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
  // Inject a polyfill module whose exports are available to the whole bundle.
  // This is more reliable than banner-based globalThis mutation, which the
  // Extension Host sandbox may silently ignore (frozen context).
  inject: ["./src/sandbox-polyfill.ts"],
  define: {
    "global": "globalThis",
    "URL": "__sandboxURL__",
    "URLSearchParams": "__sandboxUSP__",
    "import.meta.url": JSON.stringify(`file://${path.resolve(outfile)}`),
  },
});
