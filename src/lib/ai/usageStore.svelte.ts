// The AI agents' usage in the status bar. Read every 5 minutes while the status bar shows it and the window is
// visible (Anthropic refuses frequent asking), soon after an agent finishes, and on Refresh.

import { api } from "$lib/api";
import { settings } from "$lib/stores/settings.svelte";
import type { ProviderUsage } from "$lib/types";

const POLL_MS = 5 * 60_000;
/** After an agent finishes, wait a little: the agent's own bookkeeping is written by then. */
const AFTER_AGENT_MS = 15_000;
/** At most this often outside the regular poll. */
const MIN_GAP_MS = 60_000;

class UsageStore {
  /** As last read, hidden providers included until the next read; `shown` is what the status bar draws. */
  usages = $state.raw<ProviderUsage[]>([]);
  shown = $derived(this.usages.filter((usage) => !(settings.aiUsageHidden as string[]).includes(usage.provider)));
  loading = $state(false);
  /** When the last read finished (ms since the epoch). */
  updatedAt = $state<number | null>(null);
  private viewers = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private soonTimer: ReturnType<typeof setTimeout> | undefined;
  private request: Promise<void> | null = null;

  /** Reads the usage now; `fresh` is the user's Refresh (it may ask the Keychain again). */
  refresh(fresh = false): Promise<void> {
    if (this.request) {
      return this.request;
    }
    this.loading = true;
    this.request = api
      .aiUsage(fresh, settings.aiUsageHidden)
      .then((usages) => {
        this.usages = usages;
        this.updatedAt = Date.now();
      })
      .catch(() => undefined)
      .finally(() => {
        this.loading = false;
        this.request = null;
      });
    return this.request;
  }

  private stale(maxAgeMs: number): boolean {
    return this.updatedAt === null || Date.now() - this.updatedAt >= maxAgeMs;
  }

  /** An agent finished: read again shortly, unless that was just done. */
  refreshSoon(): void {
    if (this.viewers === 0 || this.soonTimer) {
      return;
    }
    this.soonTimer = setTimeout(() => {
      this.soonTimer = undefined;
      if (this.stale(MIN_GAP_MS)) {
        void this.refresh();
      }
    }, AFTER_AGENT_MS);
  }

  /** The status bar shows the usage: polling runs until the returned stop is called. */
  start(): () => void {
    this.viewers++;
    if (this.viewers === 1) {
      if (this.stale(MIN_GAP_MS)) {
        void this.refresh();
      }
      this.timer = setInterval(() => {
        if (!document.hidden) {
          void this.refresh();
        }
      }, POLL_MS);
      document.addEventListener("visibilitychange", this.onVisibility);
    }
    return () => {
      this.viewers--;
      if (this.viewers === 0) {
        clearInterval(this.timer);
        clearTimeout(this.soonTimer);
        this.soonTimer = undefined;
        document.removeEventListener("visibilitychange", this.onVisibility);
      }
    };
  }

  private onVisibility = (): void => {
    if (!document.hidden && this.stale(POLL_MS)) {
      void this.refresh();
    }
  };
}

export const usageStore = new UsageStore();
