import { describe, expect, it } from "vitest";
import type { HeadInfo } from "$lib/types";
import { rowSync, rowSyncBadge, rowSyncTooltip, syncDoneMessage, syncPlan, syncTooltip } from "./sync";

const head = (overrides: Partial<HeadInfo> = {}): HeadInfo => ({
  branch: "main",
  shortId: "abc1234",
  unborn: false,
  upstream: "origin/main",
  ahead: 0,
  behind: 0,
  ...overrides,
});

describe("sync plan", () => {
  it("offers nothing when the branch is in step with its upstream, or there is no branch", () => {
    expect(syncPlan(head())).toEqual({ kind: "none" });
    expect(syncPlan(null)).toEqual({ kind: "none" });
    expect(syncPlan(head({ branch: null }))).toEqual({ kind: "none" });
    expect(syncPlan(head({ unborn: true }))).toEqual({ kind: "none" });
  });

  it("publishes a branch without an upstream", () => {
    expect(syncPlan(head({ upstream: null, ahead: 3 }))).toEqual({ kind: "publish", branch: "main" });
  });

  it("counts what will be pulled and pushed", () => {
    expect(syncPlan(head({ ahead: 1, behind: 2 }))).toEqual({ kind: "sync", pull: 2, push: 1, upstream: "origin/main" });
  });
});

describe("sync text", () => {
  it("says what a click does", () => {
    expect(syncTooltip(syncPlan(head({ ahead: 1, behind: 2 })))).toBe(
      "Pull 2 commits from origin/main, then push 1 commit to origin/main",
    );
    expect(syncTooltip(syncPlan(head({ ahead: 1 })))).toBe("Push 1 commit to origin/main");
    expect(syncTooltip(syncPlan(head({ upstream: null })))).toBe("Push main to the remote and track it");
  });

  it("reports what happened", () => {
    expect(syncDoneMessage(2, 1)).toBe("Pulled 2 commits and pushed 1");
    expect(syncDoneMessage(1, 0)).toBe("Pulled 1 commit");
    expect(syncDoneMessage(0, 3)).toBe("Pushed 3 commits");
    expect(syncDoneMessage(0, 0)).toBe("Already in sync");
  });
});

describe("row sync button", () => {
  it("is hidden only without a branch", () => {
    expect(rowSync(null)).toEqual({ kind: "hidden" });
    expect(rowSync(head({ branch: null }))).toEqual({ kind: "hidden" });
    expect(rowSync(head({ unborn: true }))).toEqual({ kind: "hidden" });
    expect(rowSync(head())).toEqual({ kind: "sync", pull: 0, push: 0, upstream: "origin/main" });
  });

  it("publishes a branch without an upstream", () => {
    const sync = rowSync(head({ upstream: null }));
    expect(sync).toEqual({ kind: "publish", branch: "main" });
    expect(rowSyncTooltip(sync)).toBe("Publish Branch: push main to the remote and track it");
    expect(rowSyncBadge(sync)).toBe("");
  });

  it("shows counts in the tooltip and the badge", () => {
    const sync = rowSync(head({ ahead: 1, behind: 2 }));
    expect(rowSyncTooltip(sync)).toBe("Pull 2 commits from origin/main, then push 1 commit to origin/main");
    expect(rowSyncBadge(sync)).toBe("2\u2193 1\u2191");
    expect(rowSyncBadge(rowSync(head({ ahead: 3 })))).toBe("3\u2191");
  });

  it("still offers a sync when in step", () => {
    const sync = rowSync(head());
    expect(rowSyncTooltip(sync)).toBe("Sync Changes: pull from origin/main, then push");
    expect(rowSyncBadge(sync)).toBe("");
  });
});
