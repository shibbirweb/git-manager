// How the terminals draw, for the memory popup's GPU acceleration section: the
// WebGL renderer, xterm's normal (DOM) renderer, normal after WebGL failed, or
// released while hidden to free its memory.

export type TerminalDrawing = "gpu" | "normal" | "fallback" | "released";

export interface TerminalDrawingInput {
  /** One entry per open terminal. */
  drawings: TerminalDrawing[];
  /** Settings > Terminal > GPU acceleration. */
  gpuSetting: boolean;
  /** Font ligatures need the normal renderer, so they turn GPU drawing off. */
  ligatures: boolean;
}

function terminals(count: number): string {
  return count === 1 ? "1 terminal" : `${count} terminals`;
}

/** Answers "do the terminals draw with the GPU?", with the reason when they do not. */
export function terminalDrawingSummary({ drawings, gpuSetting, ligatures }: TerminalDrawingInput): string {
  if (!gpuSetting) {
    return "No, turned off in Settings";
  }
  if (ligatures) {
    return "No, font ligatures need normal drawing";
  }
  if (drawings.length === 0) {
    return "No terminal open";
  }
  const gpu = drawings.filter((drawing) => drawing === "gpu").length;
  const fallback = drawings.filter((drawing) => drawing === "fallback").length;
  const released = drawings.filter((drawing) => drawing === "released").length;
  if (gpu === 0 && fallback === 0 && released > 0) {
    return "Not now, freed while hidden";
  }
  if (gpu === 0 && fallback === 0) {
    // Hidden terminals switch to the GPU the first time they are shown.
    return "Not yet, starts when a terminal is shown";
  }
  if (gpu === 0) {
    return fallback === 1 ? "No, the GPU failed, normal drawing" : `No, the GPU failed in ${fallback} terminals`;
  }
  const used = gpu === drawings.length ? `Yes, in ${terminals(gpu)}` : `Yes, in ${gpu} of ${terminals(drawings.length)}`;
  const notes = [fallback > 0 ? `${fallback} fell back` : "", released > 0 ? `${released} freed while hidden` : ""].filter(Boolean);
  return notes.length > 0 ? `${used} (${notes.join(", ")})` : used;
}

export interface WebglInfo {
  available: boolean;
  /** The graphics chip the web view reports, when it does. */
  renderer: string | null;
}

export function webglLabel(info: WebglInfo | null): string {
  if (!info) {
    return "Checking...";
  }
  if (!info.available) {
    return "No";
  }
  return info.renderer ? `Yes (${info.renderer})` : "Yes";
}
