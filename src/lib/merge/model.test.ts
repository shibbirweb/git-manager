import { ChangeSet, EditorState, Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import type { MergeChunk } from "$lib/types";
import {
  acceptWholeSide,
  applyNonConflicting,
  applySide,
  type ChunkAction,
  type ChunkState,
  findUnresolved,
  hasConflictMarkers,
  ignoreSide,
  initialChunks,
  isResolved,
  lineStarts,
  mapChunks,
  mapLine,
  rangeOfString,
  rangeText,
  replaceLines,
  sliceLines,
  sideToResultAnchors,
  splitLines,
  unresolvedCounts,
} from "./model";

function textOf(value: string): Text {
  return Text.of(value.split("\n"));
}

function apply(doc: Text, action: ChunkAction): Text {
  return ChangeSet.of(action.changes, doc.length).apply(doc);
}

function linesOf(doc: Text, chunk: ChunkState): string[] {
  return splitLines(doc.toString()).slice(chunk.result.start, chunk.result.end);
}

// base:   a b c d e      ours changes b, theirs changes e, both change c differently
const base = "a\nb\nc\nd\ne\n";
const ours = "a\nB\nC-ours\nd\ne\n";
const theirs = "a\nb\nC-theirs\nd\nE\n";
const sides = { ours: Text.of(splitLines(ours)), theirs: Text.of(splitLines(theirs)) };
const engineChunks: MergeChunk[] = [
  { id: 0, kind: "conflict", base: { start: 1, end: 3 }, ours: { start: 1, end: 3 }, theirs: { start: 1, end: 3 } },
  { id: 1, kind: "theirsOnly", base: { start: 4, end: 5 }, ours: { start: 4, end: 5 }, theirs: { start: 4, end: 5 } },
];

describe("replaceLines", () => {
  it("replaces a middle block", () => {
    const doc = textOf("a\nb\nc");
    const edit = replaceLines(doc, { start: 1, end: 2 }, ["x", "y"]);
    expect(ChangeSet.of([edit!], doc.length).apply(doc).toString()).toBe("a\nx\ny\nc");
  });

  it("deletes a middle block including its line break", () => {
    const doc = textOf("a\nb\nc");
    const edit = replaceLines(doc, { start: 1, end: 2 }, []);
    expect(ChangeSet.of([edit!], doc.length).apply(doc).toString()).toBe("a\nc");
  });

  it("deletes the last lines by eating the preceding line break", () => {
    const doc = textOf("a\nb\nc");
    const edit = replaceLines(doc, { start: 1, end: 3 }, []);
    expect(ChangeSet.of([edit!], doc.length).apply(doc).toString()).toBe("a");
  });

  it("inserts before a line", () => {
    const doc = textOf("a\nb");
    const edit = replaceLines(doc, { start: 1, end: 1 }, ["x"]);
    expect(ChangeSet.of([edit!], doc.length).apply(doc).toString()).toBe("a\nx\nb");
  });

  it("appends after the last line", () => {
    const doc = textOf("a\nb");
    const edit = replaceLines(doc, { start: 2, end: 2 }, ["x"]);
    expect(ChangeSet.of([edit!], doc.length).apply(doc).toString()).toBe("a\nb\nx");
  });

  it("matches line-array semantics for random edits", () => {
    let seed = 7;
    const random = (bound: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };
    for (let round = 0; round < 500; round++) {
      const lines = Array.from({ length: 1 + random(6) }, (_, index) => `l${index}`);
      const start = random(lines.length + 1);
      const end = start + random(lines.length - start + 1);
      const insert = Array.from({ length: random(3) }, (_, index) => `n${index}`);
      const doc = Text.of(lines);
      const edit = replaceLines(doc, { start, end }, insert);
      const actual = edit ? ChangeSet.of([edit], doc.length).apply(doc).toString() : doc.toString();
      const expected = [...lines.slice(0, start), ...insert, ...lines.slice(end)];
      // Removing every line leaves CodeMirror's single empty line.
      expect(actual).toBe(expected.length === 0 ? "" : expected.join("\n"));
    }
  });
});

describe("chunk actions", () => {
  it("starts from the base with only the unchanged side done", () => {
    const chunks = initialChunks(engineChunks);
    expect(chunks[0].oursDone || chunks[0].theirsDone).toBe(false);
    expect(chunks[1].oursDone).toBe(true);
    expect(chunks[1].theirsDone).toBe(false);
    expect(unresolvedCounts(chunks)).toEqual({ changes: 2, conflicts: 1 });
  });

  it("applies one side, then appends the other on a conflict", () => {
    let doc = textOf(base);
    let chunks = initialChunks(engineChunks);
    const first = applySide(doc, chunks, 0, "ours", sides)!;
    doc = apply(doc, first);
    chunks = first.chunks;
    expect(linesOf(doc, chunks[0])).toEqual(["B", "C-ours"]);
    expect(isResolved(chunks[0])).toBe(false);

    const second = applySide(doc, chunks, 0, "theirs", sides)!;
    doc = apply(doc, second);
    chunks = second.chunks;
    expect(linesOf(doc, chunks[0])).toEqual(["B", "C-ours", "b", "C-theirs"]);
    expect(isResolved(chunks[0])).toBe(true);
    // The later chunk shifted by the two appended lines.
    expect(chunks[1].result).toEqual({ start: 6, end: 7 });
    expect(linesOf(doc, chunks[1])).toEqual(["e"]);
  });

  it("ignoring keeps the base text", () => {
    const chunks = initialChunks(engineChunks);
    const action = ignoreSide(chunks, 1, "theirs")!;
    expect(action.changes).toEqual([]);
    expect(isResolved(action.chunks[1])).toBe(true);
  });

  it("applies all non-conflicting changes in one transaction", () => {
    const doc = textOf(base);
    const chunks = initialChunks(engineChunks);
    const action = applyNonConflicting(doc, chunks, sides)!;
    const next = apply(doc, action);
    expect(next.toString()).toBe("a\nb\nc\nd\nE\n");
    expect(unresolvedCounts(action.chunks)).toEqual({ changes: 1, conflicts: 1 });
    expect(applyNonConflicting(next, action.chunks, sides)).toBeNull();
  });

  it("respects the side filter", () => {
    const doc = textOf(base);
    const chunks = initialChunks(engineChunks);
    expect(applyNonConflicting(doc, chunks, sides, "ours")).toBeNull();
  });

  it("accepts a whole side", () => {
    const doc = textOf(base);
    const action = acceptWholeSide(doc, initialChunks(engineChunks), theirs, "theirs");
    expect(apply(doc, action).toString()).toBe(theirs);
    expect(unresolvedCounts(action.chunks).changes).toBe(0);
  });
});

describe("mapChunks", () => {
  const chunks = initialChunks([
    { id: 0, kind: "oursOnly", base: { start: 2, end: 4 }, ours: { start: 2, end: 3 }, theirs: { start: 2, end: 4 } },
    { id: 1, kind: "theirsOnly", base: { start: 6, end: 6 }, ours: { start: 5, end: 5 }, theirs: { start: 6, end: 7 } },
  ]);
  const doc = textOf("0\n1\n2\n3\n4\n5\n6\n7");

  function edit(from: number, to: number, insert: string): ChunkState[] {
    const state = EditorState.create({ doc });
    const tr = state.update({ changes: { from, to, insert } });
    return mapChunks(chunks, tr.changes, doc);
  }

  it("shifts chunks below an inserted line", () => {
    const at = doc.line(1).to;
    const mapped = edit(at, at, "\nnew");
    expect(mapped[0].result).toEqual({ start: 3, end: 5 });
    expect(mapped[1].result).toEqual({ start: 7, end: 7 });
    expect(mapped[0].edited).toBe(false);
  });

  it("grows a chunk when typing a newline inside it", () => {
    const at = doc.line(3).to;
    const mapped = edit(at, at, "\nx");
    expect(mapped[0].result).toEqual({ start: 2, end: 5 });
    expect(mapped[0].edited).toBe(true);
    expect(mapped[1].result).toEqual({ start: 7, end: 7 });
  });

  it("leaves chunks above an edit alone", () => {
    const mapped = edit(doc.line(8).from, doc.line(8).to, "changed");
    expect(mapped[0]).toBe(chunks[0]);
    expect(mapped[1]).toBe(chunks[1]);
  });

  it("does not mark an empty chunk edited when the following line changes", () => {
    const mapped = edit(doc.line(7).from, doc.line(7).from, "x");
    expect(mapped[1].edited).toBe(false);
  });

  it("pulls the start up when a deletion crosses into the chunk", () => {
    const mapped = edit(doc.line(2).from, doc.line(3).from + 1, "");
    expect(mapped[0].result.start).toBe(1);
    expect(mapped[0].edited).toBe(true);
  });
});

describe("scroll mapping", () => {
  it("interpolates between chunk anchors", () => {
    const chunks = initialChunks(engineChunks);
    const anchors = sideToResultAnchors(chunks, "ours", 6, 6);
    expect(mapLine(0, anchors)).toBe(0);
    expect(mapLine(2, anchors)).toBe(2);
    expect(mapLine(6, anchors)).toBe(6);
  });

  it("compresses a large side chunk into a small result chunk", () => {
    const anchors: [number, number][] = [
      [0, 0],
      [10, 10],
      [30, 12],
      [40, 22],
    ];
    expect(mapLine(20, anchors)).toBe(11);
    expect(mapLine(35, anchors)).toBe(17);
  });
});

describe("navigation and markers", () => {
  it("wraps around when looking for the next unresolved chunk", () => {
    const chunks = initialChunks(engineChunks);
    expect(findUnresolved(chunks, 0, 1)?.id).toBe(0);
    expect(findUnresolved(chunks, 4, 1)?.id).toBe(0);
    expect(findUnresolved(chunks, 5, -1)?.id).toBe(1);
  });

  it("detects leftover conflict markers", () => {
    expect(hasConflictMarkers("a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> x\n")).toBe(true);
    expect(hasConflictMarkers("a\n<<<<<<<< not a marker\n")).toBe(false);
  });
});

describe("line ranges without line arrays", () => {
  const text = "zero\none\n\nthree";
  const doc = Text.of(splitLines(text));
  const starts = lineStarts(text);

  it("slices the same lines from a document and from a string", () => {
    for (const range of [
      { start: 0, end: 1 },
      { start: 1, end: 3 },
      { start: 2, end: 4 },
      { start: 0, end: 4 },
      { start: 3, end: 9 },
      { start: 2, end: 2 },
    ]) {
      const expected = splitLines(text).slice(range.start, range.end);
      expect(sliceLines(doc, range)).toEqual(expected);
      expect(rangeText(doc, range)).toBe(expected.join("\n"));
      expect(rangeOfString(text, starts, range)).toBe(expected.join("\n"));
    }
  });

  it("indexes every line start", () => {
    expect([...lineStarts("a\nbc\n")]).toEqual([0, 2, 5]);
    expect([...lineStarts("")]).toEqual([0]);
  });
});
