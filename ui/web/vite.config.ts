// The UI library's showcase: `bun run ui` serves it at http://localhost:1430. It is a dev tool only and never part
// of the app bundle.
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const libraryRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: libraryRoot,
  // The repository's svelte.config.js is SvelteKit's; the showcase is a plain Svelte app.
  plugins: [svelte({ configFile: false, preprocess: vitePreprocess() })],
  resolve: {
    alias: {
      $ui: fileURLToPath(new URL("./src/lib", import.meta.url)),
    },
  },
  server: {
    port: 1430,
    strictPort: true,
    // The design token files (ui/design-tokens) sit outside ui/web.
    fs: { allow: [repoRoot] },
  },
});
