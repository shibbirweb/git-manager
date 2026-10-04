// The UI side of the MCP bridge: the backend sends "mcp-ui-request" for a UI tool and waits for
// mcp_ui_respond. Every request is answered, also when the handlers fail to load or throw, so
// the backend never waits out its timeout because of the window.

import { api, errorMessage, onMcpOpenFolder, onMcpUiRequest } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { McpOpenFolderRequest, McpUiRequest, McpUiResult } from "$lib/types";
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

/** The clone_repository tool cloned a repository and asks this window to show it. */
async function openClone(request: McpOpenFolderRequest): Promise<void> {
  const folderPath = request?.folderPath ?? null;
  if (typeof folderPath !== "string" || folderPath === "") {
    return;
  }
  if (request.mode === "workspace") {
    await repoStore.addFolder(folderPath);
  } else {
    await repoStore.open(folderPath);
  }
}

/** Registers the UI tools and answers requests until the returned function is called. */
export function startMcpBridge(): () => void {
  void api.mcpRegisterUiTools(UI_TOOLS).catch(() => undefined);
  let stopped = false;
  const unlisteners: (() => void)[] = [];
  const keep = (listening: Promise<() => void>): void => {
    listening
      .then((stop) => {
        if (stopped) {
          stop();
        } else {
          unlisteners.push(stop);
        }
      })
      .catch(() => undefined);
  };
  keep(
    onMcpUiRequest((request) => {
      if (typeof request?.requestId === "number") {
        void answer(request);
      }
    }),
  );
  keep(onMcpOpenFolder((request) => void openClone(request)));
  return () => {
    stopped = true;
    for (const stop of unlisteners.splice(0)) {
      stop();
    }
  };
}
