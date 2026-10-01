import { describe, expect, it } from "vitest";
import { commitTabPath, commitTabsInFolder, isCommitTab, parseCommitTabPath } from "./commitTabs";
import { tabLabels } from "./tabs";

const id = "a9f492bf1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f";

describe("commit tab paths", () => {
  it("round-trips the repository and commit", () => {
    const tabPath = commitTabPath("/work/acme/storefront", id);
    expect(parseCommitTabPath(tabPath)).toEqual({ repoRoot: "/work/acme/storefront", commitId: id });
    expect(isCommitTab(tabPath)).toBe(true);
  });

  it("never mistakes a file for a commit tab", () => {
    expect(parseCommitTabPath("/work/acme/storefront/src/cart.ts")).toBeNull();
    expect(parseCommitTabPath("commit:not-a-hash@/repo")).toBeNull();
    expect(parseCommitTabPath(`commit:${id}@`)).toBeNull();
    expect(isCommitTab("commit:notes.md")).toBe(false);
  });

  it("finds the commit tabs of repositories inside a folder", () => {
    const inside = commitTabPath("/work/acme/storefront", id);
    const root = commitTabPath("/work/acme", id);
    const outside = commitTabPath("/work/acme-old/storefront", id);
    expect(commitTabsInFolder([inside, root, outside, "/work/acme/a.ts"], "/work/acme")).toEqual([inside, root]);
  });

  it("labels a commit tab with its short hash", () => {
    const tabPath = commitTabPath("/work/acme/storefront", id);
    const labels = tabLabels([
      { path: tabPath, preview: false, dirty: false },
      { path: "/work/acme/storefront/src/cart.ts", preview: false, dirty: false },
    ]);
    expect(labels.get(tabPath)).toEqual({ name: "a9f492bf", hint: null });
    expect(labels.get("/work/acme/storefront/src/cart.ts")).toEqual({ name: "cart.ts", hint: null });
  });
});
