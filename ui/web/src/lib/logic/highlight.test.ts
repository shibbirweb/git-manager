import { describe, expect, it } from "vitest";
import { highlightParts, mergeRanges } from "./highlight";

describe("highlight", () => {
  it("cuts text into plain and matched parts", () => {
    expect(highlightParts("cart.ts", [[0, 2]])).toEqual([
      { text: "ca", match: true },
      { text: "rt.ts", match: false },
    ]);
  });

  it("merges overlapping and unsorted ranges, clipped to the text", () => {
    expect(
      mergeRanges(
        [
          [4, 6],
          [0, 2],
          [1, 3],
          [5, 99],
        ],
        7,
      ),
    ).toEqual([
      [0, 3],
      [4, 7],
    ]);
    expect(
      mergeRanges(
        [
          [-5, 0],
          [3, 3],
        ],
        7,
      ),
    ).toEqual([]);
  });

  it("keeps plain text whole without matches", () => {
    expect(highlightParts("main", [])).toEqual([{ text: "main", match: false }]);
    expect(highlightParts("", [])).toEqual([{ text: "", match: false }]);
  });
});
