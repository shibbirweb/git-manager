// The bisect in progress per repository, read again whenever the status fingerprint of its
// log changes (RepoStatus.bisect), so the banner and the Log badges follow every mark.

import { api } from "$lib/api";
import type { BisectState } from "$lib/types";

class BisectStore {
  states = $state.raw<Record<string, BisectState | null>>({});
  /** The fingerprint each state was read for. */
  private loaded = new Map<string, string | null>();

  forRepo(repoRoot: string | null): BisectState | null {
    return repoRoot ? (this.states[repoRoot] ?? null) : null;
  }

  private set(repoRoot: string, state: BisectState | null): void {
    if ((this.states[repoRoot] ?? null) === state) {
      return;
    }
    this.states = { ...this.states, [repoRoot]: state };
  }

  /** Reads the bisect of `repoRoot` when its fingerprint changed; null clears it without a read. */
  async sync(repoRoot: string, fingerprint: string | null): Promise<void> {
    if (this.loaded.has(repoRoot) && this.loaded.get(repoRoot) === fingerprint) {
      return;
    }
    this.loaded.set(repoRoot, fingerprint);
    if (fingerprint === null) {
      this.set(repoRoot, null);
      return;
    }
    const state = await api.bisectState(repoRoot).catch(() => null);
    if (this.loaded.get(repoRoot) === fingerprint) {
      this.set(repoRoot, state);
    }
  }
}

export const bisectStore = new BisectStore();
