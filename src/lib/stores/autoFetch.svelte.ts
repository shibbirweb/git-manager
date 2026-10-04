// Auto fetch: every few minutes (Settings > Git), a quiet `git fetch --all --prune` of each
// repository in the workspace, one at a time, only while the window is in use. A failure
// never shows an error toast: the wait doubles (up to an hour) and the status bar shows a
// small hint. New commits reach ahead/behind through the normal refs refresh.
// When each repository is due is decided in autoFetchPlan.ts.

import { api, errorMessage } from "$lib/api";
import {
  afterFetch,
  autoFetchHint,
  canAutoFetch,
  type FetchFailure,
  fetchDelayMs,
  pickDueRepo,
  type RepoFetchState,
} from "./autoFetchPlan";
import { repoStore } from "./repo.svelte";
import { settings } from "./settings.svelte";

/** How often the timer looks for a due repository; cheap, no git runs unless one is due. */
const TICK_MS = 15 * 1000;

class AutoFetchStore {
  states = $state.raw<Record<string, RepoFetchState>>({});
  /** The repository being fetched now. */
  running = $state<string | null>(null);
  /** Changes every tick so the hint's "next try" text stays current. */
  now = $state(Date.now());

  private startedAt = Date.now();
  private lastFocusAt = Date.now();
  private lastFetchEndedAt = -Infinity;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopListening: (() => void) | null = null;

  /** Failed repositories that are still open, for the status bar. */
  get failures(): FetchFailure[] {
    const interval = settings.autoFetchIntervalMinutes;
    return repoStore.repos.flatMap((repo) => {
      const state = this.states[repo.root];
      if (!state?.lastError || state.failures === 0) {
        return [];
      }
      return [
        {
          repoName: repo.name,
          kind: state.lastError.kind,
          message: state.lastError.message,
          retryAt: state.lastAttempt + fetchDelayMs(interval, state.failures),
        },
      ];
    });
  }

  get hint(): { text: string; title: string } | null {
    return settings.autoFetch ? autoFetchHint(this.failures, this.now) : null;
  }

  /** Starts the timer with the window; returns the cleanup. */
  start(): () => void {
    this.startedAt = Date.now();
    const onFocus = () => {
      this.lastFocusAt = Date.now();
      this.schedule(0);
    };
    const onBlur = () => {
      this.lastFocusAt = Date.now();
    };
    const onVisibility = () => {
      if (document.hidden) {
        this.clearTimer();
      } else {
        this.schedule(0);
      }
    };
    const onOnline = () => this.schedule(0);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    this.stopListening = () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    this.schedule(TICK_MS);
    return () => this.stop();
  }

  stop(): void {
    this.clearTimer();
    this.stopListening?.();
    this.stopListening = null;
  }

  /** The status bar hint: forget the failures and try those repositories now. */
  retryNow(): void {
    const next: Record<string, RepoFetchState> = {};
    for (const [repoRoot, state] of Object.entries(this.states)) {
      next[repoRoot] = state.failures > 0 ? { lastAttempt: -Infinity, failures: 0, lastError: state.lastError } : state;
    }
    this.states = next;
    this.lastFetchEndedAt = -Infinity;
    this.schedule(0);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number): void {
    this.clearTimer();
    // Poll only while the window is shown.
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private async tick(): Promise<void> {
    this.timer = null;
    const now = Date.now();
    this.now = now;
    try {
      const allowed = canAutoFetch({
        enabled: settings.autoFetch,
        visible: !document.hidden,
        focused: document.hasFocus(),
        lastFocusAt: this.lastFocusAt,
        now,
        online: navigator.onLine,
        busy: this.running !== null || repoStore.busy !== null,
      });
      if (document.hasFocus()) {
        this.lastFocusAt = now;
      }
      if (!allowed) {
        return;
      }
      const repoRoots = repoStore.repos.map((repo) => repo.root);
      const repoRoot = pickDueRepo(repoRoots, this.states, settings.autoFetchIntervalMinutes, now, this.startedAt, this.lastFetchEndedAt);
      if (repoRoot) {
        await this.fetch(repoRoot);
      }
    } finally {
      this.schedule(TICK_MS);
    }
  }

  private async fetch(repoRoot: string): Promise<void> {
    this.running = repoRoot;
    try {
      const result = await api.autoFetch(repoRoot).catch((error: unknown) => ({
        outcome: "failed" as const,
        skipReason: null,
        errorKind: "other" as const,
        message: errorMessage(error),
      }));
      const ended = Date.now();
      this.lastFetchEndedAt = ended;
      this.states = { ...this.states, [repoRoot]: afterFetch(this.states[repoRoot], result, ended) };
      const stillOpen = repoStore.repos.some((repo) => repo.root === repoRoot);
      if (result.outcome === "fetched" && stillOpen) {
        await repoStore.refreshRepo(repoRoot, true);
      }
    } finally {
      this.running = null;
    }
  }
}

export const autoFetch = new AutoFetchStore();
