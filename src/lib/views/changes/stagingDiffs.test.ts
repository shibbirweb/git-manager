import { describe, expect, it } from "vitest";
import type { FileDiff, FileStatus } from "$lib/types";
import { stagingViewFits, workTreeSide } from "./stagingDiffs.svelte";

function file(staged: FileStatus["staged"], unstaged: FileStatus["unstaged"], conflicted = false): FileStatus {
  return { path: "a.ts", origPath: null, staged, unstaged, conflicted };
}

describe("stagingViewFits", () => {
  it("takes plain modified files, staged, unstaged or both", () => {
    expect(stagingViewFits(file("modified", null))).toBe(true);
    expect(stagingViewFits(file(null, "modified"))).toBe(true);
    expect(stagingViewFits(file("modified", "modified"))).toBe(true);
  });

  it("leaves out new, deleted, renamed, untracked and conflicted files", () => {
    expect(stagingViewFits(file("added", null))).toBe(false);
    expect(stagingViewFits(file(null, "deleted"))).toBe(false);
    expect(stagingViewFits(file("renamed", null))).toBe(false);
    expect(stagingViewFits(file(null, "untracked"))).toBe(false);
    expect(stagingViewFits(file("modified", "modified", true))).toBe(false);
    expect(stagingViewFits(null)).toBe(false);
  });
});

describe("workTreeSide", () => {
  it("turns the index-to-work-tree diff around", () => {
    const unstaged = {
      path: "a.ts",
      original: "a\nb\n",
      modified: "a\nb\nc\n",
      originalEol: "lf",
      modifiedEol: "crlf",
      binary: false,
      tooLarge: false,
      hunks: [[2, 2, 2, 3]],
    } as unknown as FileDiff;
    const side = workTreeSide(unstaged);
    expect([side.original, side.modified]).toEqual(["a\nb\nc\n", "a\nb\n"]);
    expect([side.originalEol, side.modifiedEol]).toEqual(["crlf", "lf"]);
    expect(side.hunks).toEqual([[2, 3, 2, 2]]);
  });
});
