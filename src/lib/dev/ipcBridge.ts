// Development only: lets an ordinary browser page drive the real backend of a running `bun tauri dev`,
// which is how scripts/screenshots.ts photographs the app with real repositories.
//
// The page, opened with `?ipc-bridge`, replaces Tauri's IPC with a relay over Vite's HMR socket. The app
// window, connected to the same dev server, runs each relayed command with the real `invoke` and sends
// the result back. Vite only relays these messages when the dev server was started with GM_IPC_BRIDGE=1
// (see vite.config.js), so a normal `bun tauri dev` ignores them. None of this is in a production build.

import { invoke } from "@tauri-apps/api/core";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

interface Call {
  callId: number;
  cmd: string;
  args: unknown;
}

interface Result {
  callId: number;
  ok: boolean;
  value: unknown;
}

type Override = (args: unknown) => unknown;

declare global {
  interface Window {
    /** Commands the page answers itself instead of relaying, set by the screenshot script. */
    __GM_IPC_OVERRIDES__?: Record<string, Override>;
  }
}

export function startIpcBridge(): void {
  const hot = import.meta.hot;
  if (!hot) {
    return;
  }
  if (new URLSearchParams(location.search).has("ipc-bridge")) {
    relayFromPage(hot);
  } else if ("__TAURI_INTERNALS__" in window) {
    serveFromApp(hot);
  }
}

function relayFromPage(hot: NonNullable<ImportMeta["hot"]>): void {
  let nextCallId = 1;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>();
  hot.on("gm-ipc:result", (result: Result) => {
    const waiter = pending.get(result.callId);
    if (!waiter) {
      return;
    }
    pending.delete(result.callId);
    if (result.ok) {
      waiter.resolve(result.value);
    } else {
      waiter.reject(result.value);
    }
  });
  mockWindows("main");
  mockIPC(
    (cmd, args) => {
      const override = window.__GM_IPC_OVERRIDES__?.[cmd];
      if (override) {
        return override(args);
      }
      const callId = nextCallId++;
      return new Promise((resolve, reject) => {
        pending.set(callId, { resolve, reject });
        hot.send("gm-ipc:call", { callId, cmd, args } satisfies Call);
      });
    },
    { shouldMockEvents: true },
  );
}

function serveFromApp(hot: NonNullable<ImportMeta["hot"]>): void {
  hot.on("gm-ipc:call", async (call: Call) => {
    let result: Result;
    try {
      result = { callId: call.callId, ok: true, value: await invoke(call.cmd, (call.args ?? {}) as Record<string, unknown>) };
    } catch (error) {
      result = { callId: call.callId, ok: false, value: error };
    }
    hot.send("gm-ipc:result", result);
  });
}
