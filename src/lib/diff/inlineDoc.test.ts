import { describe, expect, it } from "vitest";
import type { LineHunk } from "$lib/types";
import {
  applyBlock,
  buildInlineDoc,
  collapsedRuns,
  docLineOf,
  fallbackHunks,
  inlineChangeMarks,
  inlineSelection,
  inlineWordMarks,
  newLineAt,
} from "./inlineDoc";

// one / two -> TWO / three / four (removed) / five (added after the last line)
const original = "one\ntwo\nthree\nfour\n";
const modified = "one\nTWO\nthree\n\nfive";
const hunks: LineHunk[] = [
  [1, 2, 1, 2],
  [3, 5, 3, 5],
];

describe("buildInlineDoc", () => {
  const doc = buildInlineDoc(original, modified, hunks);

  it("puts each change's removed lines above its added lines", () => {
    expect(doc.text.split("\n")).toEqual(["one", "two", "TWO", "three", "four", "", "", "five"]);
    expect(doc.lines.map((line) => line.kind)).toEqual(["context", "deleted", "added", "context", "deleted", "deleted", "added", "added"]);
  });

  it("numbers every line on both sides", () => {
    expect(doc.lines.map((line) => [line.old, line.new])).toEqual([
      [0, 0],
      [1, null],
      [null, 1],
      [2, 2],
      [3, null],
      [4, null],
      [null, 3],
      [null, 4],
    ]);
  });

  it("finds a new line's document line and back", () => {
    expect(docLineOf(doc, 2)).toBe(3);
    expect(newLineAt(doc, 3)).toBe(2);
    // A removed line counts as the line after it.
    expect(newLineAt(doc, 1)).toBe(1);
  });

  it("keeps an unchanged file as it is", () => {
    const same = buildInlineDoc("a\nb\n", "a\nb\n", []);
    expect(same.text).toBe("a\nb\n");
    expect(same.blocks).toEqual([]);
  });

  it("shows a new file as added lines only", () => {
    const added = buildInlineDoc("", "a\nb", [[0, 1, 0, 2]]);
    expect(added.lines.map((line) => line.kind)).toEqual(["deleted", "added", "added"]);
  });
});

describe("inline line actions", () => {
  const doc = buildInlineDoc(original, modified, hunks);

  it("picks exactly the removed and added lines a selection covers", () => {
    expect(inlineSelection(doc, [[1, 1]])).toEqual({ oldLines: [[1, 2]], newLines: [] });
    expect(inlineSelection(doc, [[0, 3]])).toEqual({ oldLines: [[1, 2]], newLines: [[1, 2]] });
    expect(inlineSelection(doc, [[3, 3]])).toEqual({ oldLines: [], newLines: [] });
    expect(inlineSelection(doc, [[4, 7]])).toEqual({ oldLines: [[3, 5]], newLines: [[3, 5]] });
  });

  it("stages one change into the old text", () => {
    expect(applyBlock(original, modified, doc.blocks[0], "stage")).toEqual({
      target: "original",
      text: "one\nTWO\nthree\nfour\n",
    });
  });

  it("unstages one change from the new text", () => {
    expect(applyBlock(original, modified, doc.blocks[1], "unstage")).toEqual({
      target: "modified",
      text: "one\nTWO\nthree\nfour\n",
    });
  });
});

describe("inline marks", () => {
  const doc = buildInlineDoc(original, modified, hunks);

  it("highlights the changed words of a modified change on both its lines", () => {
    const marks = inlineWordMarks(buildInlineDoc("a cat\n", "a dog\n", [[0, 1, 0, 1]]));
    const text = buildInlineDoc("a cat\n", "a dog\n", [[0, 1, 0, 1]]).text;
    expect(marks.map((mark) => text.slice(mark.from, mark.to))).toEqual(["cat", "dog"]);
  });

  it("leaves pure additions and removals without word marks", () => {
    const added = buildInlineDoc("a\n", "a\nb\n", [[1, 1, 1, 2]]);
    expect(inlineWordMarks(added)).toEqual([]);
  });

  it("gives the ruler one tick per change", () => {
    expect(inlineChangeMarks(doc)).toEqual([
      { from: 1, to: 3, kind: "modified" },
      { from: 4, to: 8, kind: "modified" },
    ]);
    expect(inlineChangeMarks(buildInlineDoc("a\nb\n", "a\n", [[1, 2, 1, 1]]))).toEqual([{ from: 1, to: 2, kind: "deleted" }]);
  });
});

describe("collapsedRuns", () => {
  it("folds long unchanged runs but keeps the margin next to changes", () => {
    const lines = Array.from({ length: 20 }, (_, index) => `line ${index}`);
    const changed = [...lines];
    changed[10] = "changed";
    const doc = buildInlineDoc(lines.join("\n"), changed.join("\n"), [[10, 11, 10, 11]]);
    expect(collapsedRuns(doc, 3, 4)).toEqual([
      [0, 7],
      [15, 21],
    ]);
  });

  it("leaves short runs open", () => {
    const doc = buildInlineDoc("a\nb\nc\n", "a\nB\nc\n", [[1, 2, 1, 2]]);
    expect(collapsedRuns(doc, 3, 4)).toEqual([]);
  });
});

describe("fallbackHunks", () => {
  it("finds line hunks without the backend's", () => {
    expect(fallbackHunks(original, modified)).toEqual(hunks);
  });
});
