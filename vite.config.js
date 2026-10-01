/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

/**
 * Relays IPC between a browser page and the running app window (src/lib/dev/ipcBridge.ts), for
 * scripts/screenshots.ts. Only with GM_IPC_BRIDGE=1: any page on the dev server could then run git
 * commands through the app, so it is never on by default.
 *
 * @returns {import("vite").Plugin}
 */
function ipcBridge() {
  return {
    name: "gm-ipc-bridge",
    apply: "serve",
    configureServer(/** @type {import("vite").ViteDevServer} */ server) {
      if (process.env.GM_IPC_BRIDGE !== "1") {
        return;
      }
      for (const event of ["gm-ipc:call", "gm-ipc:result"]) {
        server.ws.on(event, (/** @type {unknown} */ data) => server.ws.send(event, data));
      }
      server.config.logger.info("IPC bridge on: pages opened with ?ipc-bridge use the app's backend");
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [sveltekit(), ipcBridge()],

  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
