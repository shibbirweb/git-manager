import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import type { LineHunk } from "$lib/types";
import { mergeRanges, rangeLines, selectedChangeLines, selectionSize } from "./lineSelection";

// old: a b c d e        new: a B c d E f
const hunks: LineHunk[] = [
  [1, 2, 1, 2],
  [4, 5, 4, 6],
];

describe("rangeLines", () => {
  const doc = Text.of(["zero", "one", "two", "three"]);

  it("covers the lines of a range, the caret's line when empty", () => {
    expect(rangeLines(doc, 0, 0)).toEqual([0, 0]);
    expect(rangeLines(doc, doc.line(2).from + 1, doc.line(3).from + 2)).toEqual([1, 2]);
    // Backwards ranges too.
    expect(rangeLines(doc, doc.line(3).from + 2, doc.line(2).from + 1)).toEqual([1, 2]);
  });

  it("leaves out a last line the range only touches at its start", () => {
    expect(rangeLines(doc, doc.line(2).from, doc.line(4).from)).toEqual([1, 2]);
    expect(rangeLines(doc, doc.line(2).from, doc.line(2).from)).toEqual([1, 1]);
  });
});

describe("mergeRanges", () => {
  it("sorts and joins overlapping and touching ranges", () => {
    expect(
      mergeRanges([
        [5, 7],
        [1, 2],
        [2, 3],
        [6, 9],
        [4, 4],
      ]),
    ).toEqual([
      [1, 3],
      [5, 9],
    ]);
  });
});

describe("selectedChangeLines", () => {
  it("picks a changed line on the right with the old line it replaces", () => {
    expect(selectedChangeLines(hunks, "new", [[1, 1]])).toEqual({ oldLines: [[1, 2]], newLines: [[1, 2]] });
  });

  it("ignores unchanged lines", () => {
    const none = selectedChangeLines(hunks, "new", [[2, 3]]);
    expect(none).toEqual({ oldLines: [], newLines: [] });
    expect(selectionSize(none)).toBe(0);
  });

  it("spans several hunks", () => {
    const all = selectedChangeLines(hunks, "new", [[0, 5]]);
    expect(all).toEqual({
      oldLines: [
        [1, 2],
        [4, 5],
      ],
      newLines: [
        [1, 2],
        [4, 6],
      ],
    });
    expect(selectionSize(all)).toBe(5);
  });

  it("pairs lines inside a longer hunk and takes the rest at its end", () => {
    // old e -> new E f: the added f alone has no old line facing it.
    expect(selectedChangeLines(hunks, "new", [[5, 5]])).toEqual({ oldLines: [], newLines: [[5, 6]] });
    expect(selectedChangeLines(hunks, "new", [[4, 4]])).toEqual({ oldLines: [[4, 5]], newLines: [[4, 5]] });
    // From the left, the last old line of the hunk takes both new lines.
    expect(selectedChangeLines(hunks, "old", [[4, 4]])).toEqual({ oldLines: [[4, 5]], newLines: [[4, 6]] });
  });

  it("picks a deletion when the selection touches the lines around it", () => {
    // old: a b c, new: a c (b deleted, between new lines 0 and 1).
    const deletion: LineHunk[] = [[1, 2, 1, 1]];
    expect(selectedChangeLines(deletion, "new", [[0, 0]])).toEqual({ oldLines: [[1, 2]], newLines: [] });
    expect(selectedChangeLines(deletion, "new", [[1, 1]])).toEqual({ oldLines: [[1, 2]], newLines: [] });
    expect(selectedChangeLines(deletion, "new", [[2, 2]])).toEqual({ oldLines: [], newLines: [] });
    // From the left the deleted line itself is selected.
    expect(selectedChangeLines(deletion, "old", [[1, 1]])).toEqual({ oldLines: [[1, 2]], newLines: [] });
  });

  it("picks an addition from the left the same way", () => {
    // old: a c, new: a b c.
    const addition: LineHunk[] = [[1, 1, 1, 2]];
    expect(selectedChangeLines(addition, "old", [[0, 0]])).toEqual({ oldLines: [], newLines: [[1, 2]] });
    expect(selectedChangeLines(addition, "new", [[1, 1]])).toEqual({ oldLines: [], newLines: [[1, 2]] });
  });

  it("joins the ranges of several cursors", () => {
    const picked = selectedChangeLines(hunks, "new", [
      [4, 4],
      [5, 5],
    ]);
    expect(picked).toEqual({ oldLines: [[4, 5]], newLines: [[4, 6]] });
  });
});
