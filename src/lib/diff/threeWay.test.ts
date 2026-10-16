import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { mapLine } from "$lib/merge/model";
import type { LineHunk } from "$lib/types";
import {
  changeSummary,
  flipHunks,
  parentAnchors,
  parentFold,
  parentMarks,
  resultFolds,
  resultMarks,
  rulerMarks,
  takeChange,
  threeWayChanges,
  touches,
} from "./threeWay";

// Parent 1 lacks result lines 2..4 (the merged branch added them); parent 2 lacks line 8 and has its own line 5.
const left: LineHunk[] = [[2, 2, 2, 4]];
const right: LineHunk[] = [
  [5, 6, 7, 8],
  [9, 9, 10, 11],
];

describe("threeWayChanges", () => {
  it("types each parent's changes against the result", () => {
    const changes = threeWayChanges(left, right);
    expect(changes.left.map((change) => change.type)).toEqual(["added"]);
    expect(changes.right.map((change) => change.type)).toEqual(["modified", "added"]);
    expect(changes.right[0]).toEqual({
      index: 0,
      parent: { start: 5, end: 6 },
      result: { start: 7, end: 8 },
      type: "modified",
    });
  });

  it("marks result lines both parents changed as a conflict", () => {
    const changes = threeWayChanges([[3, 5, 3, 6]], [[3, 4, 4, 5]]);
    expect(changes.left[0].type).toBe("conflict");
    expect(changes.right[0].type).toBe("conflict");
    const marks = resultMarks(changes);
    expect(marks).toEqual([{ range: { start: 3, end: 6 }, type: "conflict" }]);
    expect(changeSummary(marks)).toBe("1 change, 1 conflict");
  });

  it("counts empty ranges at an edge as touching", () => {
    expect(touches({ start: 3, end: 3 }, { start: 3, end: 5 })).toBe(true);
    expect(touches({ start: 1, end: 3 }, { start: 3, end: 5 })).toBe(false);
    expect(touches({ start: 2, end: 2 }, { start: 3, end: 5 })).toBe(false);
  });
});

describe("resultMarks", () => {
  it("keeps apart changes that do not touch, in order", () => {
    const marks = resultMarks(threeWayChanges(left, right));
    expect(marks.map((mark) => [mark.range.start, mark.range.end, mark.type])).toEqual([
      [2, 4, "added"],
      [7, 8, "modified"],
      [10, 11, "added"],
    ]);
    expect(changeSummary(marks)).toBe("3 changes");
    expect(rulerMarks(marks)[0]).toEqual({ from: 2, to: 4, kind: "added" });
  });
});

describe("parentMarks", () => {
  it("highlights the words a parent's changed line differs in", () => {
    const parent = Text.of(["a", "b", "old value", "d"]);
    const result = Text.of(["a", "b", "new value", "d"]);
    const changes = threeWayChanges([[2, 3, 2, 3]], []);
    const [mark] = parentMarks(changes.left, parent, result);
    expect(mark.range).toEqual({ start: 2, end: 3 });
    expect(mark.inline?.length).toBeGreaterThan(0);
  });
});

describe("parentAnchors", () => {
  it("maps a parent's lines to the result's", () => {
    const changes = threeWayChanges(left, right);
    const anchors = parentAnchors(changes.left, 10, 12);
    expect(mapLine(5, anchors)).toBe(7);
    expect(mapLine(1, anchors)).toBe(1);
  });
});

describe("folds", () => {
  it("folds the result's runs that match both parents, and the same lines in a parent", () => {
    // Result line 30 (0-based) changed against parent 1, which lacks result lines 10..12.
    const changes = threeWayChanges(
      [
        [10, 10, 10, 13],
        [27, 28, 30, 31],
      ],
      [],
    );
    const marks = resultMarks(changes);
    const folds = resultFolds(marks, 60);
    expect(folds).toEqual([
      { first: 1, last: 7 },
      { first: 17, last: 27 },
      { first: 35, last: 60 },
    ]);
    const anchors = parentAnchors(changes.left, 57, 60);
    expect(folds.map((fold) => parentFold(fold, anchors))).toEqual([
      { first: 1, last: 7 },
      { first: 14, last: 24 },
      { first: 32, last: 57 },
    ]);
  });
});

describe("the staging view", () => {
  // HEAD | index | work tree: one staged change (line 1), and the work tree adds a line after line 3.
  const head = "a\nB\nc\nd";
  const index = "a\nb\nc\nd";
  const worktree = "a\nb\nc\nnew\nd";
  const staged: LineHunk[] = [[1, 2, 1, 2]];
  const unstaged: LineHunk[] = [[3, 3, 3, 4]];

  it("types the work tree's additions as added, with no conflicts", () => {
    const changes = threeWayChanges(staged, flipHunks(unstaged), { rightNewer: true, conflicts: false });
    expect(changes.left.map((change) => change.type)).toEqual(["modified"]);
    expect(changes.right).toEqual([
      { index: 0, parent: { start: 3, end: 4 }, result: { start: 3, end: 3 }, type: "added" },
    ]);
  });

  it("stages and unstages one change by taking its lines into the index", () => {
    const changes = threeWayChanges(staged, flipHunks(unstaged), { rightNewer: true, conflicts: false });
    expect(takeChange(index, worktree, changes.right[0])).toBe(worktree);
    expect(takeChange(index, head, changes.left[0])).toBe(head);
  });

  it("merges touching middle ranges without calling them a conflict", () => {
    const changes = threeWayChanges([[1, 2, 1, 2]], [[1, 2, 1, 2]], { conflicts: false });
    expect(resultMarks(changes, false)).toEqual([{ range: { start: 1, end: 2 }, type: "modified" }]);
  });
});
