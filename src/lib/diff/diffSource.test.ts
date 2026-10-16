import { describe, expect, it } from "vitest";
import type { FileDiff, FileStatus } from "$lib/types";
import { changeRevisions, type DiffSource, panesKey, threePaneKind } from "./diffSource";
import { changeSelection } from "./threeWay";
import { rightAgainstMiddle } from "./workTreePane.svelte";

function diff(original: string, modified: string, extra: Partial<FileDiff> = {}): FileDiff {
  return {
    path: "a.ts",
    original,
    modified,
    originalEol: "lf",
    modifiedEol: "lf",
    binary: false,
    tooLarge: false,
    ...extra,
  };
}

const modified: FileStatus = { path: "a.ts", origPath: null, staged: null, unstaged: "modified", conflicted: false };
const added: FileStatus = { ...modified, unstaged: null, staged: "added" };
const root = "/repo";

function commit(secondParent: FileDiff | null = null, parentId: string | null = "p1"): DiffSource {
  return {
    kind: "commit",
    repoRoot: root,
    commitId: "c1",
    filePath: "a.ts",
    origPath: null,
    parentId,
    secondParent,
    parents: parentId ? [parentId] : [],
  };
}

describe("threePaneKind", () => {
  it("offers the staging view for plain modified uncommitted files", () => {
    const changes: DiffSource = {
      kind: "changes",
      repoRoot: root,
      filePath: "a.ts",
      area: "unstaged",
      status: modified,
    };
    expect(threePaneKind(changes, diff("a", "b"))).toBe("staging");
    expect(threePaneKind({ ...changes, status: added }, diff("", "b"))).toBeNull();
    const head: DiffSource = { kind: "head", repoRoot: root, filePath: "a.ts", origPath: null, status: modified };
    expect(threePaneKind(head, diff("a", "b"))).toBe("staging");
  });

  it("puts a merge's parents around it, and any other commit next to the work tree", () => {
    expect(threePaneKind(commit(diff("x", "b")), diff("a", "b"))).toBe("merge");
    expect(threePaneKind(commit(diff("x", "b", { binary: true })), diff("a", "b"))).toBeNull();
    expect(threePaneKind(commit(), diff("a", "b"))).toBe("workTree");
    expect(threePaneKind(commit(null, null), diff("", "b"))).toBe("workTree");
    expect(threePaneKind(commit(), diff("a", "")), "a deleted file").toBeNull();
  });

  it("puts two revisions next to the work tree, but not a revision already against it", () => {
    const branches: DiffSource = {
      kind: "revisions",
      repoRoot: root,
      filePath: "a.ts",
      origPath: null,
      from: "base",
      to: "topic",
    };
    expect(threePaneKind(branches, diff("a", "b"))).toBe("workTree");
    expect(threePaneKind({ ...branches, to: null }, diff("a", "b"))).toBeNull();
  });

  it("never offers three panes for binary files or plain diffs", () => {
    expect(threePaneKind(commit(), diff("a", "b", { tooLarge: true }))).toBeNull();
    expect(threePaneKind({ kind: "plain" }, diff("a", "b"))).toBeNull();
  });
});

describe("panesKey", () => {
  it("keeps uncommitted changes and history on their own settings", () => {
    expect(panesKey({ kind: "head", repoRoot: root, filePath: "a.ts", origPath: null, status: null })).toBe(
      "changesDiffPanes",
    );
    expect(panesKey(commit())).toBe("mergeDiffPanes");
  });
});

describe("changeRevisions", () => {
  it("reverts against HEAD in the Changes tab, and between a commit and its parent", () => {
    const head: DiffSource = { kind: "head", repoRoot: root, filePath: "a.ts", origPath: "old.ts", status: null };
    expect(changeRevisions(head)).toEqual({
      repoRoot: root,
      filePath: "a.ts",
      origPath: "old.ts",
      oldRevision: "HEAD",
      newRevision: null,
    });
    expect(changeRevisions(commit())).toMatchObject({ oldRevision: "p1", newRevision: "c1" });
    expect(changeRevisions(commit(null, null))).toMatchObject({ oldRevision: null, newRevision: "c1" });
  });

  it("leaves the Changes diff to its own line actions, and plain diffs read-only", () => {
    const changes: DiffSource = { kind: "changes", repoRoot: root, filePath: "a.ts", area: "staged", status: null };
    expect(changeRevisions(changes)).toBeNull();
    expect(changeRevisions({ kind: "plain" })).toBeNull();
  });
});

describe("changeSelection", () => {
  it("picks a band's side lines as old and its middle lines as new", () => {
    const change = { index: 0, parent: { start: 2, end: 4 }, result: { start: 2, end: 2 }, type: "deleted" as const };
    expect(changeSelection(change)).toEqual({ oldLines: [[2, 4]], newLines: [] });
  });
});

describe("rightAgainstMiddle", () => {
  it("keeps the work tree pane when its middle matches, and finds the hunks again when it does not", () => {
    const side = diff("work", "middle", { hunks: [[0, 1, 0, 1]] });
    expect(rightAgainstMiddle(side, "middle")).toBe(side);
    const fixed = rightAgainstMiddle(side, "middle\r");
    expect(fixed.modified).toBe("middle\r");
    expect(fixed.hunks).toBeUndefined();
  });
});
