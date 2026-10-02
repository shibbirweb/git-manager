import { describe, expect, it } from "vitest";
import type { LocalBranch, Refs, RemoteBranch } from "$lib/types";
import {
  type BranchActionItem,
  type BranchActionRow,
  type BranchPopupContext,
  filterBranches,
  localBranchActions,
  remoteBranchActions,
  trackingHint,
} from "./branchPopup";

function local(name: string, extra: Partial<LocalBranch> = {}): LocalBranch {
  return { name, isHead: false, upstream: null, ahead: 0, behind: 0, shortId: null, ...extra };
}

const remote: RemoteBranch = { name: "origin/feature", remote: "origin", branch: "feature" };
const context: BranchPopupContext = { current: "main", busy: false, operation: false, hasRemotes: true };

function labels(rows: BranchActionRow[]): string[] {
  return rows.map((row) => (row === "separator" ? "-" : row.label));
}

function find(rows: BranchActionRow[], label: string): BranchActionItem | undefined {
  return rows.find((row): row is BranchActionItem => row !== "separator" && row.label === label);
}

describe("branches popup", () => {
  it("offers JetBrains' actions for another local branch", () => {
    const rows = localBranchActions(local("feature", { upstream: "origin/feature" }), context);
    expect(labels(rows)).toEqual([
      "Checkout",
      "New Branch from 'feature'...",
      "Checkout and Rebase onto 'main'",
      "-",
      "Compare with 'main'",
      "Show Diff with Working Tree",
      "-",
      "Rebase 'main' onto 'feature'",
      "Merge 'feature' into 'main'...",
      "-",
      "Update",
      "Push",
      "-",
      "Rename...",
      "Delete",
    ]);
    expect(find(rows, "Update")).toMatchObject({ disabled: false, hint: "origin/feature" });
    expect(find(rows, "Delete")).toMatchObject({ danger: true });
    expect(find(localBranchActions(local("lonely"), context), "Update")?.disabled).toBe(true);
  });

  it("offers upstream actions for the current branch", () => {
    const tracked = localBranchActions(local("main", { isHead: true, upstream: "origin/main" }), context);
    expect(labels(tracked)).toEqual([
      "New Branch from 'main'...",
      "-",
      "Update",
      "Push...",
      "-",
      "Track Remote Branch...",
      "Unset Upstream",
      "-",
      "Rename...",
    ]);
    const untracked = localBranchActions(local("main", { isHead: true }), { ...context, hasRemotes: false });
    expect(find(untracked, "Unset Upstream")).toBeUndefined();
    expect(find(untracked, "Track Remote Branch...")?.disabled).toBe(true);
    expect(find(untracked, "Update")?.disabled).toBe(true);
  });

  it("offers checkout, compare and integration for a remote branch", () => {
    const rows = remoteBranchActions(remote, context);
    expect(labels(rows)).toContain("Rebase 'main' onto 'origin/feature'");
    expect(labels(rows)).not.toContain("Delete");
    const blocked = remoteBranchActions(remote, { ...context, operation: true });
    expect(find(blocked, "Checkout")?.disabled).toBe(true);
    expect(find(blocked, "Compare with 'main'")?.disabled).toBe(false);
    const detached = remoteBranchActions(remote, { ...context, current: null });
    expect(labels(detached)).toEqual(["Checkout", "New Branch from 'origin/feature'...", "Show Diff with Working Tree"]);
  });

  it("filters by every word and lists the current branch first", () => {
    const refs: Refs = {
      local: [local("feature/login"), local("main", { isHead: true }), local("feature/logout")],
      remote: [remote, { name: "origin/main", remote: "origin", branch: "main" }],
      tags: [],
      remotes: ["origin"],
    };
    expect(filterBranches(refs, "").local.map((branch) => branch.name)).toEqual(["main", "feature/login", "feature/logout"]);
    const found = filterBranches(refs, "feat LOGIN");
    expect(found.local.map((branch) => branch.name)).toEqual(["feature/login"]);
    expect(found.remote).toEqual([]);
    expect(filterBranches(null, "x")).toEqual({ local: [], remote: [] });
    expect(trackingHint(local("a", { upstream: "origin/a", ahead: 2, behind: 1 }))).toBe("origin/a, 2 ahead, 1 behind");
  });
});
