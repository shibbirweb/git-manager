import { Chunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { mapLine } from "$lib/merge/model";
import { chunkKind, chunkLines, copyChange, diffAnchors } from "./splitChunks";

function text(content: string): Text {
  return Text.of(content.split("\n"));
}

function chunks(before: string, after: string) {
  const a = text(before);
  const b = text(after);
  return { a, b, chunks: Chunk.build(a, b) };
}

function apply(doc: Text, edit: { from: number; to: number; insert: string }): string {
  return doc.replace(edit.from, edit.to, text(edit.insert)).toString();
}

describe("chunkLines", () => {
  it("joins a changed line to its new lines", () => {
    const diff = chunks("one\ntwo\nthree\n", "one\nTWO\n2b\nthree\n");
    expect(diff.chunks).toHaveLength(1);
    expect(chunkLines(diff.chunks[0], diff.a, diff.b)).toEqual({ a: { start: 1, end: 2 }, b: { start: 1, end: 3 } });
    expect(chunkKind(diff.chunks[0])).toBe("modified");
  });

  it("puts an added line against the gap where it goes", () => {
    const diff = chunks("one\nthree\n", "one\ntwo\nthree\n");
    expect(chunkLines(diff.chunks[0], diff.a, diff.b)).toEqual({ a: { start: 1, end: 1 }, b: { start: 1, end: 2 } });
    expect(chunkKind(diff.chunks[0])).toBe("added");
  });

  it("puts a removed line against the gap it leaves", () => {
    const diff = chunks("one\ntwo\nthree\n", "one\nthree\n");
    expect(chunkLines(diff.chunks[0], diff.a, diff.b)).toEqual({ a: { start: 1, end: 2 }, b: { start: 1, end: 1 } });
    expect(chunkKind(diff.chunks[0])).toBe("deleted");
  });

  it("handles changes at the end without a final line break", () => {
    // A last line without a line break counts as changed when lines are added after it.
    const added = chunks("one", "one\ntwo");
    expect(chunkLines(added.chunks[0], added.a, added.b)).toEqual({ a: { start: 0, end: 1 }, b: { start: 0, end: 2 } });
    const fromEmpty = chunks("", "one\ntwo");
    expect(chunkLines(fromEmpty.chunks[0], fromEmpty.a, fromEmpty.b)).toEqual({
      a: { start: 0, end: 1 },
      b: { start: 0, end: 2 },
    });
    const added2 = chunks("one\n", "one\ntwo\n");
    expect(chunkLines(added2.chunks[0], added2.a, added2.b)).toEqual({
      a: { start: 1, end: 1 },
      b: { start: 1, end: 2 },
    });
  });
});

describe("diffAnchors", () => {
  it("maps lines around the changes", () => {
    const diff = chunks("a\nb\nc\nd\n", "a\nx\ny\nz\nc\nd\n");
    const anchors = diffAnchors(diff.chunks, diff.a, diff.b);
    expect(anchors[0]).toEqual([0, 0]);
    expect(anchors[anchors.length - 1]).toEqual([diff.a.lines, diff.b.lines]);
    // Line 3 ("d") on the left is line 5 on the right.
    expect(mapLine(3, anchors)).toBe(5);
    expect(mapLine(0, anchors)).toBe(0);
  });
});

describe("copyChange", () => {
  it("stages a change by copying the right side over the left", () => {
    const diff = chunks("one\ntwo\nthree\n", "one\nTWO\n2b\nthree\n");
    const edit = copyChange(diff.chunks[0], true, diff.a, diff.b);
    expect(edit.target).toBe("a");
    expect(apply(diff.a, edit)).toBe(diff.b.toString());
  });

  it("unstages a change by copying the left side over the right", () => {
    const diff = chunks("one\nthree\n", "one\ntwo\nthree\n");
    const edit = copyChange(diff.chunks[0], false, diff.a, diff.b);
    expect(edit.target).toBe("b");
    expect(apply(diff.b, edit)).toBe(diff.a.toString());
  });

  it("copies a change at the end of the text", () => {
    const diff = chunks("one\ntwo", "one\nTWO");
    expect(apply(diff.a, copyChange(diff.chunks[0], true, diff.a, diff.b))).toBe("one\nTWO");
  });
});
