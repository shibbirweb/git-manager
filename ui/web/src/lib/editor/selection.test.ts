import { describe, expect, it } from "vitest";
import { outerCorners, type SelectionBox } from "./selection";

const box = (left: number, top: number, width: number, height = 20): SelectionBox => ({ left, top, width, height });

describe("outerCorners", () => {
  it("rounds every corner of a selection inside one line", () => {
    expect(outerCorners([box(40, 0, 60)])).toEqual([["tl", "tr", "bl", "br"]]);
  });

  it("keeps the joins square where the first line, the middle block and the last line meet", () => {
    const first = box(100, 0, 300);
    const middle = box(0, 20, 400, 40);
    const last = box(0, 60, 150);
    expect(outerCorners([first, middle, last])).toEqual([
      ["tl", "tr"],
      ["tl", "br"],
      ["bl", "br"],
    ]);
  });

  it("rounds both corners where two lines only touch at a point", () => {
    const first = box(100, 0, 300);
    const last = box(0, 20, 100);
    expect(outerCorners([first, last])).toEqual([
      ["tl", "tr", "bl", "br"],
      ["tl", "tr", "bl", "br"],
    ]);
  });

  it("joins two lines that overlap", () => {
    const first = box(100, 0, 300);
    const last = box(0, 20, 250);
    expect(outerCorners([first, last])).toEqual([
      ["tl", "tr", "br"],
      ["tl", "bl", "br"],
    ]);
  });

  it("treats boxes a pixel apart as touching", () => {
    const first = box(0, 0, 200, 20);
    const last = box(0, 21, 200, 20);
    expect(outerCorners([first, last])).toEqual([
      ["tl", "tr"],
      ["bl", "br"],
    ]);
  });
});
