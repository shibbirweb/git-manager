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
      for (const event of ["gm-ipc:call", "gm-ipc:result", "gm-ipc:channel", "gm-ipc:event", "gm-ipc:subscribe", "gm-ipc:hello", "gm-ipc:here"]) {
        server.ws.on(event, (/** @type {unknown} */ data) => {
          if (process.env.GM_IPC_DEBUG === "1") {
            const d = /** @type {any} */ (data);
            server.config.logger.info(`[bridge] ${event} ${d?.cmd ?? d?.callId ?? d?.channelId ?? ""} ${JSON.stringify(data)?.length ?? 0}B clients=${server.ws.clients.size}`);
          }
          server.ws.send(event, data);
        });
      }
      server.config.logger.info("IPC bridge on: pages opened with ?ipc-bridge use the app's backend");
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [sveltekit(), ipcBridge()],

  // xterm and the Markdown preview's libraries are imported lazily, so Vite would find them only
  // when first used and then pre-bundle them and reload the window in dev. Listing them here
  // bundles them at start.
  optimizeDeps: {
    include: [
      "@xterm/xterm",
      "@xterm/addon-fit",
      "@xterm/addon-web-links",
      "markdown-it",
      "dompurify",
      "mermaid",
      "@milkdown/kit/core",
      "@milkdown/kit/ctx",
      "@milkdown/kit/plugin/clipboard",
      "@milkdown/kit/plugin/history",
      "@milkdown/kit/preset/commonmark",
      "@milkdown/kit/preset/gfm",
      "@milkdown/kit/prose/model",
      "@milkdown/kit/prose/state",
      "@milkdown/kit/prose/view",
      "@milkdown/kit/utils",
    ],
  },

  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Vitest blanks CSS by default; the theme tests read app.css's tokens (?raw) and the file
    // icon tests compare the committed minimal.css.
    css: { include: [/src\/app\.css/, /static\/file-icons\/minimal\/minimal\.css/] },
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
