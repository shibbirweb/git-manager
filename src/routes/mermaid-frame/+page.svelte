<!--
  The page that draws Mermaid diagrams, loaded in a hidden frame by src/lib/markdown/mermaid.ts.
  The mermaid library is imported here and nowhere else, so removing the frame when the last
  document with diagrams closes takes the whole library out of memory.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { drawDiagram, type FrameRequest, type FrameResponse } from "$lib/markdown/mermaidFrame";

  onMount(() => {
    const parentWindow = window.parent;
    // A reply that cannot be sent still answers, so the window never waits for the timeout.
    const reply = (response: FrameResponse, requestId: number) => {
      try {
        parentWindow.postMessage(response, "*");
      } catch (error) {
        parentWindow.postMessage({ type: "gm-mermaid-result", requestId, error: String(error) }, "*");
      }
    };
    const onMessage = (event: MessageEvent) => {
      // Only the window that made this frame; its origin may read "null" on tauri:// pages.
      if (event.source !== parentWindow) {
        return;
      }
      const request = event.data as FrameRequest | null;
      if (request?.type !== "gm-mermaid-render") {
        return;
      }
      void drawDiagram(request).then((response) => reply(response, request.requestId));
    };
    window.addEventListener("message", onMessage);
    parentWindow.postMessage({ type: "gm-mermaid-ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  });
</script>
