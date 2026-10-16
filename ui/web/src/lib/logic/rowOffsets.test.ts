import { describe, expect, it } from "vitest";
import { listWindow, rowOffsets, scrollToCenterBox, scrollToShowBox, visibleByOffsets } from "./rowOffsets";

describe("rowOffsets", () => {
  it("adds the heights up, ending with the total", () => {
    const heights = [24, 120, 24];
    expect(rowOffsets(3, (index) => heights[index])).toEqual([0, 24, 144, 168]);
    expect(rowOffsets(0, () => 24)).toEqual([0]);
  });
});

describe("visibleByOffsets", () => {
  // Ten rows of 24, but row 2 is open and 200 tall.
  const offsets = rowOffsets(10, (index) => (index === 2 ? 200 : 24));

  it("finds the rows in view across a tall one", () => {
    expect(visibleByOffsets(offsets, 0, 60, 0)).toEqual({ first: 0, last: 3 });
    expect(visibleByOffsets(offsets, 100, 50, 0)).toEqual({ first: 2, last: 3 });
    expect(visibleByOffsets(offsets, 248, 48, 0)).toEqual({ first: 3, last: 6 });
  });

  it("adds the overscan and stays inside the list", () => {
    expect(visibleByOffsets(offsets, 0, 60, 8)).toEqual({ first: 0, last: 10 });
    expect(
      visibleByOffsets(
        rowOffsets(0, () => 24),
        0,
        60,
      ),
    ).toEqual({ first: 0, last: 0 });
  });
});

describe("scrollToShowBox", () => {
  it("scrolls up to a row above, down to one below, and not at all for one in view", () => {
    expect(scrollToShowBox(10, 34, 50, 100)).toBe(10);
    expect(scrollToShowBox(160, 184, 50, 100)).toBe(84);
    expect(scrollToShowBox(60, 84, 50, 100)).toBeNull();
  });

  it("shows the top of a row taller than the view", () => {
    expect(scrollToShowBox(300, 700, 0, 100)).toBe(300);
  });
});

describe("scrollToCenterBox", () => {
  it("puts the row in the middle of the view", () => {
    expect(scrollToCenterBox(500, 526, 200)).toBe(413);
  });

  it("stops at the top for rows near the start", () => {
    expect(scrollToCenterBox(26, 52, 200)).toBe(0);
  });
});

describe("listWindow", () => {
  it("draws every row of a plain list and sizes a virtual one", () => {
    expect(listWindow(50, null, null, 0, 100)).toEqual({ first: 0, last: 50, total: null });
    const fixed = listWindow(1000, 20, null, 2000, 100);
    expect(fixed.total).toBe("20000px");
    expect(fixed.first).toBeLessThanOrEqual(100);
    expect(fixed.last).toBeGreaterThanOrEqual(105);
    const measured = listWindow(3, 20, [0, 10, 40, 70], 0, 100);
    expect(measured).toEqual({ first: 0, last: 3, total: "70px" });
  });
});
