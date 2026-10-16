// Runs inside the hidden Mermaid frame (src/routes/mermaid-frame): draws one diagram per
// request. Only this module imports mermaid; the window never does.

import type { Mermaid, MermaidConfig } from "mermaid";

export interface FrameRequest {
  type: "gm-mermaid-render";
  requestId: number;
  diagramId: string;
  source: string;
  config: MermaidConfig;
}

export type FrameResponse = { type: "gm-mermaid-result"; requestId: number } & ({ svg: string } | { error: string });

let library: Promise<Mermaid> | null = null;
let configured = "";

function load(): Promise<Mermaid> {
  library ??= import("mermaid").then((module) => module.default);
  return library;
}

/** Mermaid draws in a hidden element of the page and can leave it behind when a diagram fails. */
function removeLeftovers(diagramId: string): void {
  for (const id of [diagramId, `d${diagramId}`, `i${diagramId}`]) {
    document.getElementById(id)?.remove();
  }
}

export async function drawDiagram(request: FrameRequest): Promise<FrameResponse> {
  const { requestId, diagramId, source, config } = request;
  try {
    const mermaid = await load();
    const key = JSON.stringify(config);
    if (key !== configured) {
      configured = key;
      mermaid.initialize(config);
    }
    const { svg } = await mermaid.render(diagramId, source);
    return { type: "gm-mermaid-result", requestId, svg };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Diagram error");
    return { type: "gm-mermaid-result", requestId, error: message || "Diagram error" };
  } finally {
    removeLeftovers(diagramId);
  }
}
