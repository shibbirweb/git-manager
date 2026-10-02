// The debug memory log's state for the Settings page; the log itself runs in the backend.

import { api } from "$lib/api";
import type { MemoryLogStatus } from "$lib/types";

class MemoryLogStore {
  status = $state.raw<MemoryLogStatus | null>(null);

  async configure(enabled: boolean, intervalMs: number, thresholdMb: number): Promise<void> {
    try {
      this.status = await api.memoryLogConfigure(enabled, intervalMs, thresholdMb);
    } catch {
      this.status = null;
    }
  }
}

export const memoryLog = new MemoryLogStore();
