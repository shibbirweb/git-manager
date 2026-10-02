// The UI side of the MCP bridge: the backend sends "mcp-ui-request" for a UI tool and waits for
// mcp_ui_respond. Every request is answered, also when the handlers fail to load or throw, so
// the backend never waits out its timeout because of the window.

import { api, errorMessage, onMcpUiRequest } from "$lib/api";
import type { McpUiRequest, McpUiResult } from "$lib/types";
import { UI_TOOLS } from "./toolDefs";

async function answer(request: McpUiRequest): Promise<void> {
  let reply: McpUiResult;
  try {
    // Loaded on the first call, so the app carries none of it while no agent uses it.
    const { handleUiRequest } = await import("./handlers");
    reply = await handleUiRequest(request);
  } catch (error) {
    reply = { ok: false, text: errorMessage(error), structured: null, imagePngBase64: null };
  }
  await api.mcpUiRespond(request.requestId, reply).catch(() => undefined);
}

/** Registers the UI tools and answers requests until the returned function is called. */
export function startMcpBridge(): () => void {
  void api.mcpRegisterUiTools(UI_TOOLS).catch(() => undefined);
  let stopped = false;
  let unlisten: (() => void) | null = null;
  onMcpUiRequest((request) => {
    if (typeof request?.requestId === "number") {
      void answer(request);
    }
  })
    .then((stop) => {
      if (stopped) {
        stop();
      } else {
        unlisten = stop;
      }
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
    unlisten?.();
  };
}
