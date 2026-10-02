// Which renderer each open terminal draws with, for the memory popup. A terminal
// reports changes itself and is forgotten when it closes, so nothing outlives it.

import type { TerminalDrawing } from "./gpuStatus";

class GpuRenderers {
  drawings = $state.raw<ReadonlyMap<number, TerminalDrawing>>(new Map());

  set(terminalKey: number, drawing: TerminalDrawing): void {
    if (this.drawings.get(terminalKey) === drawing) {
      return;
    }
    this.drawings = new Map(this.drawings).set(terminalKey, drawing);
  }

  forget(terminalKey: number): void {
    if (!this.drawings.has(terminalKey)) {
      return;
    }
    const next = new Map(this.drawings);
    next.delete(terminalKey);
    this.drawings = next;
  }
}

export const gpuRenderers = new GpuRenderers();
