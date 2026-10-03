import { describe, expect, it } from "vitest";
import type { AutoFetchResult } from "$lib/types";
import {
  afterFetch,
  autoFetchHint,
  canAutoFetch,
  FIRST_FETCH_DELAY_MS,
  fetchDelayMs,
  intervalMs,
  MAX_BACKOFF_MS,
  pickDueRepo,
  RECENT_FOCUS_MS,
  REPO_GAP_MS,
  type RepoFetchState,
} from "./autoFetchPlan";

const MINUTE = 60 * 1000;

const result = (overrides: Partial<AutoFetchResult> = {}): AutoFetchResult => ({
  outcome: "fetched",
  skipReason: null,
  errorKind: null,
  message: "",
  ...overrides,
});

describe("fetchDelayMs", () => {
  it("waits the interval and doubles it for each failure, up to an hour", () => {
    expect(fetchDelayMs(10, 0)).toBe(10 * MINUTE);
    expect(fetchDelayMs(10, 1)).toBe(20 * MINUTE);
    expect(fetchDelayMs(10, 2)).toBe(40 * MINUTE);
    expect(fetchDelayMs(10, 3)).toBe(MAX_BACKOFF_MS);
    expect(fetchDelayMs(10, 50)).toBe(MAX_BACKOFF_MS);
    expect(fetchDelayMs(1, 3)).toBe(8 * MINUTE);
  });

  it("never waits less than a long interval", () => {
    expect(fetchDelayMs(120, 0)).toBe(120 * MINUTE);
    expect(fetchDelayMs(120, 2)).toBe(120 * MINUTE);
  });

  it("clamps odd intervals", () => {
    expect(intervalMs(0)).toBe(MINUTE);
    expect(intervalMs(99999)).toBe(1440 * MINUTE);
    expect(intervalMs(Number.NaN)).toBe(10 * MINUTE);
    expect(intervalMs(2.4)).toBe(2 * MINUTE);
  });
});

describe("canAutoFetch", () => {
  const now = 1_000_000_000;
  const base = { enabled: true, visible: true, focused: true, lastFocusAt: now, now, online: true, busy: false };

  it("runs while the window is in use", () => {
    expect(canAutoFetch(base)).toBe(true);
    expect(canAutoFetch({ ...base, focused: false, lastFocusAt: now - RECENT_FOCUS_MS })).toBe(true);
  });

  it("stops when off, hidden, long unfocused, offline or busy", () => {
    expect(canAutoFetch({ ...base, enabled: false })).toBe(false);
    expect(canAutoFetch({ ...base, visible: false })).toBe(false);
    expect(canAutoFetch({ ...base, focused: false, lastFocusAt: now - RECENT_FOCUS_MS - 1 })).toBe(false);
    expect(canAutoFetch({ ...base, online: false })).toBe(false);
    expect(canAutoFetch({ ...base, busy: true })).toBe(false);
  });
});

describe("pickDueRepo", () => {
  const startedAt = 0;
  const done = (lastAttempt: number, failures = 0): RepoFetchState => ({ lastAttempt, failures, lastError: null });

  it("waits a little after start, then takes one repository at a time", () => {
    const repos = ["/a", "/b"];
    expect(pickDueRepo(repos, {}, 10, FIRST_FETCH_DELAY_MS - 1, startedAt, -Infinity)).toBeNull();
    expect(pickDueRepo(repos, {}, 10, FIRST_FETCH_DELAY_MS, startedAt, -Infinity)).toBe("/a");
    const states = { "/a": done(FIRST_FETCH_DELAY_MS) };
    expect(pickDueRepo(repos, states, 10, FIRST_FETCH_DELAY_MS + 1, startedAt, FIRST_FETCH_DELAY_MS)).toBeNull();
    const later = FIRST_FETCH_DELAY_MS + REPO_GAP_MS;
    expect(pickDueRepo(repos, states, 10, later, startedAt, FIRST_FETCH_DELAY_MS)).toBe("/b");
  });

  it("takes the most overdue repository and respects the back off", () => {
    const states = { "/a": done(0), "/b": done(0, 2), "/c": done(-5 * MINUTE) };
    expect(pickDueRepo(["/a", "/b", "/c"], states, 10, 10 * MINUTE, startedAt, -Infinity)).toBe("/c");
    expect(pickDueRepo(["/b"], states, 10, 39 * MINUTE, startedAt, -Infinity)).toBeNull();
    expect(pickDueRepo(["/b"], states, 10, 40 * MINUTE, startedAt, -Infinity)).toBe("/b");
  });
});

describe("afterFetch", () => {
  it("counts failures in a row and clears them on success", () => {
    const failed = afterFetch(undefined, result({ outcome: "failed", errorKind: "auth", message: "fatal: no" }), 5);
    expect(failed).toEqual({ lastAttempt: 5, failures: 1, lastError: { kind: "auth", message: "fatal: no" } });
    expect(afterFetch(failed, result({ outcome: "failed", errorKind: null }), 6).failures).toBe(2);
    expect(afterFetch(failed, result({ outcome: "upToDate" }), 7)).toEqual({ lastAttempt: 7, failures: 0, lastError: null });
    expect(afterFetch(failed, result({ outcome: "skipped", skipReason: "noRemotes" }), 8).failures).toBe(0);
  });
});

describe("autoFetchHint", () => {
  it("is quiet without failures", () => {
    expect(autoFetchHint([], 0)).toBeNull();
  });

  it("names the problem and when the next try is", () => {
    const now = 0;
    const auth = { repoName: "app", kind: "auth" as const, message: "fatal: Authentication failed", retryAt: 20 * MINUTE };
    expect(autoFetchHint([auth], now)).toEqual({
      text: "Fetch needs sign-in",
      title: "app: fatal: Authentication failed\nNext try in 20 minutes. Click to try again now.",
    });
    const offline = { repoName: "lib", kind: "offline" as const, message: "", retryAt: 30 * 1000 };
    expect(autoFetchHint([offline], now)?.text).toBe("Fetch offline");
    const hint = autoFetchHint([auth, offline], now);
    expect(hint?.text).toBe("Auto fetch failed (2)");
    expect(hint?.title).toContain("lib: fetch failed");
    expect(hint?.title).toContain("Next try in 1 minute.");
  });
});
