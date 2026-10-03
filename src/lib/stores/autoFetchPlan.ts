// When the auto fetch timer (autoFetch.svelte.ts) fetches which repository: pure, so the
// timing rules are tested without timers.

import type { AutoFetchResult } from "$lib/types";

export const DEFAULT_AUTO_FETCH_MINUTES = 10;
export const AUTO_FETCH_INTERVAL_RANGE = [1, 1440] as const;
/** Failures double the wait up to this, or up to the interval when that is longer. */
export const MAX_BACKOFF_MS = 60 * 60 * 1000;
/** The window still counts as in use this long after it lost focus. */
export const RECENT_FOCUS_MS = 10 * 60 * 1000;
/** The first fetch waits a little after start, so opening a workspace stays quick. */
export const FIRST_FETCH_DELAY_MS = 30 * 1000;
/** A pause between two repositories, so one fetch runs at a time with room between them. */
export const REPO_GAP_MS = 5 * 1000;

export interface RepoFetchState {
  /** When the last fetch of this repository ended (ms since the epoch). */
  lastAttempt: number;
  /** Failed fetches in a row; 0 after a success or a skip. */
  failures: number;
  lastError: { kind: NonNullable<AutoFetchResult["errorKind"]>; message: string } | null;
}

export function intervalMs(intervalMinutes: number): number {
  const [min, max] = AUTO_FETCH_INTERVAL_RANGE;
  const minutes = Number.isFinite(intervalMinutes) ? Math.min(max, Math.max(min, Math.round(intervalMinutes))) : DEFAULT_AUTO_FETCH_MINUTES;
  return minutes * 60 * 1000;
}

/** The wait after a fetch: the interval, doubled for each failure in a row, capped at an hour (or the interval). */
export function fetchDelayMs(intervalMinutes: number, failures: number): number {
  const base = intervalMs(intervalMinutes);
  if (failures <= 0) {
    return base;
  }
  const cap = Math.max(MAX_BACKOFF_MS, base);
  return Math.min(cap, base * 2 ** Math.min(failures, 20));
}

export interface AutoFetchConditions {
  enabled: boolean;
  /** The page is not hidden (window shown, not minimized). */
  visible: boolean;
  focused: boolean;
  /** When the window last had focus (ms since the epoch). */
  lastFocusAt: number;
  now: number;
  online: boolean;
  /** Another git operation or an auto fetch is running. */
  busy: boolean;
}

/** Fetch only while the window is in use: shown, focused now or a little while ago, online and idle. */
export function canAutoFetch(conditions: AutoFetchConditions): boolean {
  if (!conditions.enabled || !conditions.visible || !conditions.online || conditions.busy) {
    return false;
  }
  return conditions.focused || conditions.now - conditions.lastFocusAt <= RECENT_FOCUS_MS;
}

/** When `repoRoot` is due next. */
export function nextFetchAt(state: RepoFetchState | undefined, intervalMinutes: number, startedAt: number): number {
  if (!state) {
    return startedAt + FIRST_FETCH_DELAY_MS;
  }
  return state.lastAttempt + fetchDelayMs(intervalMinutes, state.failures);
}

/**
 * The repository to fetch now: the most overdue one, or null. `lastFetchEndedAt` keeps a gap
 * after the previous fetch of any repository.
 */
export function pickDueRepo(
  repoRoots: readonly string[],
  states: Readonly<Record<string, RepoFetchState>>,
  intervalMinutes: number,
  now: number,
  startedAt: number,
  lastFetchEndedAt: number,
): string | null {
  if (now - lastFetchEndedAt < REPO_GAP_MS) {
    return null;
  }
  let picked: string | null = null;
  let pickedAt = Infinity;
  for (const repoRoot of repoRoots) {
    const dueAt = nextFetchAt(states[repoRoot], intervalMinutes, startedAt);
    if (dueAt <= now && dueAt < pickedAt) {
      picked = repoRoot;
      pickedAt = dueAt;
    }
  }
  return picked;
}

/** The state after a fetch ended with `result`. */
export function afterFetch(previous: RepoFetchState | undefined, result: AutoFetchResult, now: number): RepoFetchState {
  if (result.outcome === "failed") {
    return {
      lastAttempt: now,
      failures: (previous?.failures ?? 0) + 1,
      lastError: { kind: result.errorKind ?? "other", message: result.message },
    };
  }
  return { lastAttempt: now, failures: 0, lastError: null };
}

export interface FetchFailure {
  repoName: string;
  kind: NonNullable<AutoFetchResult["errorKind"]>;
  message: string;
  /** When the timer tries again (ms since the epoch). */
  retryAt: number;
}

function minutesUntil(at: number, now: number): string {
  const minutes = Math.max(1, Math.round((at - now) / 60000));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/** The status bar hint for failed auto fetches, or null when none failed. */
export function autoFetchHint(failures: readonly FetchFailure[], now: number): { text: string; title: string } | null {
  if (failures.length === 0) {
    return null;
  }
  const kinds = new Set(failures.map((failure) => failure.kind));
  const label = kinds.size > 1 ? "Auto fetch failed" : kinds.has("auth") ? "Fetch needs sign-in" : kinds.has("offline") ? "Fetch offline" : "Auto fetch failed";
  const text = failures.length > 1 ? `${label} (${failures.length})` : label;
  const nextRetry = Math.min(...failures.map((failure) => failure.retryAt));
  const lines = failures.map((failure) => `${failure.repoName}: ${failure.message || "fetch failed"}`);
  lines.push(`Next try in ${minutesUntil(nextRetry, now)}. Click to try again now.`);
  return { text, title: lines.join("\n") };
}
