import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const uiRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Removes `crossorigin` from built asset tags so the Ableton webview loads
 * bundled CSS/JS from the local HTTP server without CORS failures.
 */
function stripCrossorigin(): { name: string; transformIndexHtml: (html: string) => string } {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(="[^"]*")?/g, '');
    },
  };
}

export default defineConfig({
  root: uiRoot,
  plugins: [
    // Tailwind must run before React so utilities are generated from scanned sources
    tailwindcss(),
    react(),
    stripCrossorigin(),
  ],
  build: {
    outDir: path.resolve(uiRoot, '../dist/ui'),
    emptyOutDir: true,
  },
  base: './',
});
