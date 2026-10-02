// Development only: lets an ordinary browser page drive the real backend of a running `bun tauri dev`,
// which is how scripts/screenshots.ts photographs the app with real repositories.
//
// The page, opened with `?ipc-bridge`, replaces Tauri's IPC with a relay over Vite's HMR socket. The app
// window, connected to the same dev server, runs each relayed command with the real `invoke` and sends
// the result back. When several app windows share the dev server (an older one left running, say), the
// page asks who is there and talks to one: the app process whose pid the URL names (`?ipc-bridge=<pid>`),
// else the first that answers. Tauri Channels in the arguments (terminal output, search progress) get a real
// Channel in the app window whose messages are relayed back to the page's Channel, and a few backend
// events are relayed the same way. Vite only relays these messages when the dev server was started with
// GM_IPC_BRIDGE=1 (see vite.config.js), so a normal `bun tauri dev` ignores them. None of this is in a
// production build.

import { Channel, invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

interface Call {
  serverId: string;
  callId: number;
  cmd: string;
  args: unknown;
}

interface Result {
  serverId: string;
  callId: number;
  ok: boolean;
  value: unknown;
}

interface ChannelMessage {
  serverId: string;
  channelId: number;
  message: unknown;
}

interface RelayedEvent {
  serverId: string;
  event: string;
  payload: unknown;
}

/** An app window offering to serve the page. */
interface Here {
  serverId: string;
  pid: number | null;
}

/** Raw bytes do not survive JSON, so they travel as base64. */
interface EncodedBytes {
  __gmBytes: string;
}

type Override = (args: unknown) => unknown;

/** Backend events the page needs: a terminal or script ended, the Git Console got a command. */
const RELAYED_EVENTS = ["terminal-exited", "git-command"];

const CHANNEL_PREFIX = "__CHANNEL__:";

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

function encodeMessage(message: unknown): unknown {
  if (!(message instanceof ArrayBuffer)) {
    return message;
  }
  const bytes = new Uint8Array(message);
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return { __gmBytes: btoa(binary) } satisfies EncodedBytes;
}

function decodeMessage(message: unknown): unknown {
  if (!message || typeof message !== "object" || !("__gmBytes" in message)) {
    return message;
  }
  const binary = atob((message as EncodedBytes).__gmBytes);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function relayFromPage(hot: NonNullable<ImportMeta["hot"]>): void {
  let nextCallId = 1;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>();
  const channels = new Map<number, Channel<unknown>>();
  const wantedPid = Number(new URLSearchParams(location.search).get("ipc-bridge") ?? "") || null;
  let serverId: string | null = null;
  let chooseServer: (chosen: string) => void = () => undefined;
  const server = new Promise<string>((resolve, reject) => {
    chooseServer = resolve;
    setTimeout(() => reject({ kind: "blocked", message: "No app window answered the IPC bridge" }), 10000);
  });
  hot.on("gm-ipc:here", (here: Here) => {
    if (serverId === null && (wantedPid === null || here.pid === wantedPid)) {
      serverId = here.serverId;
      chooseServer(here.serverId);
      hot.send("gm-ipc:subscribe", { serverId: here.serverId, events: RELAYED_EVENTS });
    }
  });
  hot.on("gm-ipc:result", (result: Result) => {
    if (result.serverId !== serverId) {
      return;
    }
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
  hot.on("gm-ipc:channel", (relayed: ChannelMessage) => {
    if (relayed.serverId === serverId) {
      channels.get(relayed.channelId)?.onmessage(decodeMessage(relayed.message));
    }
  });
  hot.on("gm-ipc:event", (relayed: RelayedEvent) => {
    if (relayed.serverId === serverId) {
      void emit(relayed.event, relayed.payload);
    }
  });
  mockWindows("main");
  mockIPC(
    (cmd, args) => {
      const override = window.__GM_IPC_OVERRIDES__?.[cmd];
      if (override) {
        return override(args);
      }
      // A Channel goes over the socket as its "__CHANNEL__:<id>" string; the app answers with that id.
      for (const value of Object.values((args ?? {}) as Record<string, unknown>)) {
        if (value instanceof Channel) {
          channels.set(value.id, value);
        }
      }
      const callId = nextCallId++;
      return server.then(
        (chosen) =>
          new Promise((resolve, reject) => {
            pending.set(callId, { resolve, reject });
            hot.send("gm-ipc:call", { serverId: chosen, callId, cmd, args } satisfies Call);
          }),
      );
    },
    { shouldMockEvents: true },
  );
  hot.send("gm-ipc:hello", {});
}

function serveFromApp(hot: NonNullable<ImportMeta["hot"]>): void {
  const serverId = Math.random().toString(36).slice(2);
  const subscribed = new Set<string>();
  // The first process memory_usage reports is the app itself.
  const ownPid = invoke("memory_usage")
    .then((usage) => (usage as { processes?: { pid: number }[] }).processes?.[0]?.pid ?? null)
    .catch(() => null);
  hot.on("gm-ipc:hello", async () => {
    const pid = await Promise.race([ownPid, new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))]);
    hot.send("gm-ipc:here", { serverId, pid } satisfies Here);
  });
  hot.on("gm-ipc:call", async (call: Call) => {
    if (call.serverId !== serverId) {
      return;
    }
    let result: Result;
    try {
      result = { serverId, callId: call.callId, ok: true, value: await invoke(call.cmd, withChannels(hot, serverId, call.args)) };
    } catch (error) {
      result = { serverId, callId: call.callId, ok: false, value: error };
    }
    hot.send("gm-ipc:result", result);
  });
  hot.on("gm-ipc:subscribe", (request: { serverId: string; events: string[] }) => {
    if (request.serverId !== serverId) {
      return;
    }
    for (const event of request.events ?? []) {
      if (subscribed.has(event)) {
        continue;
      }
      subscribed.add(event);
      void listen(event, (relayed) => {
        hot.send("gm-ipc:event", { serverId, event, payload: relayed.payload } satisfies RelayedEvent);
      });
    }
  });
}

/** The page's Channel placeholders replaced by real Channels that forward to the page. */
function withChannels(hot: NonNullable<ImportMeta["hot"]>, serverId: string, args: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = { ...((args ?? {}) as Record<string, unknown>) };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value !== "string" || !value.startsWith(CHANNEL_PREFIX)) {
      continue;
    }
    const channelId = Number(value.slice(CHANNEL_PREFIX.length));
    result[key] = new Channel<unknown>((message) => {
      hot.send("gm-ipc:channel", { serverId, channelId, message: encodeMessage(message) } satisfies ChannelMessage);
    });
  }
  return result;
}
