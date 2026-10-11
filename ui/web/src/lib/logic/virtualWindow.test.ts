import { describe, expect, it } from "vitest";
import { scrollToShow, visibleRows } from "./virtualWindow";

describe("visibleRows", () => {
  it("draws the rows in view plus the overscan, within the list", () => {
    expect(visibleRows(0, 240, 24, 1000, 2)).toEqual({ first: 0, last: 12 });
    expect(visibleRows(2400, 240, 24, 1000, 2)).toEqual({ first: 98, last: 112 });
    expect(visibleRows(23_900, 240, 24, 1000, 2)).toEqual({ first: 993, last: 1000 });
  });

  it("draws nothing for an empty list or a zero row height", () => {
    expect(visibleRows(0, 240, 24, 0)).toEqual({ first: 0, last: 0 });
    expect(visibleRows(0, 240, 0, 10)).toEqual({ first: 0, last: 0 });
  });
});

describe("scrollToShow", () => {
  it("scrolls up or down just enough, and not at all when the row is in view", () => {
    expect(scrollToShow(2, 24, 100, 240)).toBe(48);
    expect(scrollToShow(20, 24, 100, 240)).toBe(264);
    expect(scrollToShow(6, 24, 100, 240)).toBeNull();
  });
});
