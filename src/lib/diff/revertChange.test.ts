import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { chunkLines, chunkSelection, hunkSelection } from "./revertChange";

const doc = (text: string) => Text.of(text.split("\n"));

describe("chunkLines", () => {
  it("is null for a side without lines", () => {
    expect(chunkLines(doc("a\nb"), 2, 2)).toBeNull();
  });

  it("covers the lines up to the one ending at to", () => {
    // "a\nb\nc\n": line 1 is 0..1, line 2 is 2..3; to is one past line 2's break.
    expect(chunkLines(doc("a\nb\nc\n"), 2, 4)).toEqual([1, 2]);
    expect(chunkLines(doc("a\nb\nc\n"), 0, 6)).toEqual([0, 3]);
  });

  it("takes a last line without a line break, where to is past the end", () => {
    const text = doc("a\nb");
    expect(chunkLines(text, 2, text.length + 1)).toEqual([1, 2]);
  });
});

describe("chunkSelection", () => {
  it("joins both sides, leaving out an empty one", () => {
    const docA = doc("a\nb\nc\n");
    const docB = doc("a\nc\n");
    expect(chunkSelection({ fromA: 2, toA: 4, fromB: 2, toB: 2 }, docA, docB)).toEqual({
      oldLines: [[1, 2]],
      newLines: [],
    });
  });
});

describe("hunkSelection", () => {
  it("names the hunk's old and new lines", () => {
    expect(hunkSelection([3, 5, 3, 4])).toEqual({ oldLines: [[3, 5]], newLines: [[3, 4]] });
  });

  it("leaves out the empty side of an addition", () => {
    expect(hunkSelection([2, 2, 2, 6])).toEqual({ oldLines: [], newLines: [[2, 6]] });
  });
});
