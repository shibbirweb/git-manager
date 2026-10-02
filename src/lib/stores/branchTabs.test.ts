import { describe, expect, it } from "vitest";
import { type BranchTabRef, branchTabPath, branchTabsInFolder, branchTabTitle, isBranchTab, parseBranchTabPath } from "./branchTabs";
import { isPseudoTab } from "./pseudoTabs";
import { tabLabels, tabsInFolder } from "./tabs";

const refs: BranchTabRef[] = [
  { kind: "compare", repoRoot: "/work/app", branchName: "feature/a|b", baseName: "main" },
  { kind: "worktree", repoRoot: "/work/app", revision: "origin/release 1" },
];

describe("branch tabs", () => {
  it("round-trips every kind and counts as a pseudo tab", () => {
    for (const ref of refs) {
      const tabPath = branchTabPath(ref);
      expect(tabPath.startsWith("/")).toBe(false);
      expect(parseBranchTabPath(tabPath)).toEqual(ref);
      expect(isBranchTab(tabPath)).toBe(true);
      expect(isPseudoTab(tabPath)).toBe(true);
    }
  });

  it("refuses other paths", () => {
    for (const tabPath of [
      "/work/app/main.ts",
      "branches-other:%2Fwork|main",
      "branches-compare:%2Fwork|main",
      "branches-compare:%2Fwork|main|",
      "branches-worktree:%2Fwork",
      "branches-worktree:%2Fwork|a|b",
      "branches-worktree:%E0%A4%A|main",
    ]) {
      expect(parseBranchTabPath(tabPath), tabPath).toBeNull();
    }
  });

  it("titles each kind, labels it in the strip and closes with its folder", () => {
    expect(branchTabTitle(refs[0])).toEqual({ name: "feature/a|b vs main", title: "feature/a|b compared with main (app)" });
    expect(branchTabTitle(refs[1]).name).toBe("origin/release 1 vs Working Tree");
    const paths = refs.map(branchTabPath);
    const other = branchTabPath({ kind: "worktree", repoRoot: "/elsewhere", revision: "main" });
    expect(branchTabsInFolder([...paths, other], "/work")).toEqual(paths);
    expect(tabsInFolder([...paths, other], "/work")).toEqual(paths);
    const labels = tabLabels(paths.map((path) => ({ path, preview: false, dirty: false })));
    expect(labels.get(paths[0])?.name).toBe("feature/a|b vs main");
  });
});
