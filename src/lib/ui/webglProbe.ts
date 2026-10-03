// Asks the web view whether it offers WebGL 2 and which graphics chip it reports.
// The test context is released at once, so the check holds no GPU memory.

import type { WebglInfo } from "$lib/terminal/gpuStatus";

export function probeWebgl(): WebglInfo {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return { available: false, renderer: null };
  }
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer: unknown = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return { available: true, renderer: typeof renderer === "string" && renderer !== "" ? renderer : null };
}
