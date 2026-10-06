import { describe, expect, it } from "vitest";
import { foldEdges, foldRanges, revealFold } from "./foldModel";

describe("foldRanges", () => {
  it("folds before, between and after changes, keeping the margin next to each", () => {
    // Changes on line 20 and lines 50-51 of a 100 line text.
    const changes = [
      { first: 20, after: 21 },
      { first: 50, after: 52 },
    ];
    expect(foldRanges(changes, 100, 3, 4)).toEqual([
      { first: 1, last: 16 },
      { first: 24, last: 46 },
      { first: 55, last: 100 },
    ]);
  });

  it("keeps the margin around a change with no lines on this side", () => {
    expect(foldRanges([{ first: 20, after: 20 }], 40, 3, 4)).toEqual([
      { first: 1, last: 16 },
      { first: 23, last: 40 },
    ]);
  });

  it("leaves short runs open", () => {
    expect(foldRanges([{ first: 5, after: 6 }], 11, 3, 4)).toEqual([]);
  });
});

describe("revealFold", () => {
  const range = { first: 24, last: 63 };

  it("shows a step of lines at the chosen edge", () => {
    expect(revealFold(range, "top", 10, 4)).toEqual({ first: 34, last: 63 });
    expect(revealFold(range, "bottom", 10, 4)).toEqual({ first: 24, last: 53 });
  });

  it("opens fully on Show all or when too few lines would stay folded", () => {
    expect(revealFold(range, "all", 10, 4)).toBeNull();
    expect(revealFold({ first: 1, last: 13 }, "top", 10, 4)).toBeNull();
    expect(revealFold({ first: 1, last: 14 }, "bottom", 10, 4)).toEqual({ first: 1, last: 4 });
  });
});

describe("foldEdges", () => {
  it("offers only the edges next to visible code", () => {
    expect(foldEdges({ first: 24, last: 63 }, 100, 10, 4)).toEqual({ top: true, bottom: true });
    expect(foldEdges({ first: 1, last: 40 }, 100, 10, 4)).toEqual({ top: false, bottom: true });
    expect(foldEdges({ first: 60, last: 100 }, 100, 10, 4)).toEqual({ top: true, bottom: false });
  });

  it("offers none when one step would open the whole fold", () => {
    expect(foldEdges({ first: 24, last: 36 }, 100, 10, 4)).toEqual({ top: false, bottom: false });
  });
});
