import { describe, expect, it } from "vitest";
import { dropGap, edgeScrollStep, EDGE_SCROLL_MAX_STEP, gapIndex, wheelScroll } from "./tabDrag";

const row = [
  { left: 0, right: 100, top: 0, bottom: 30 },
  { left: 100, right: 160, top: 0, bottom: 30 },
  { left: 160, right: 300, top: 0, bottom: 30 },
];

describe("dropGap", () => {
  it("lands before the tab whose middle the pointer has not passed", () => {
    expect(dropGap(row, 10, 0, false)).toBe(0);
    expect(dropGap(row, 120, 0, false)).toBe(1);
    expect(dropGap(row, 140, 0, false)).toBe(2);
    expect(dropGap(row, 290, 0, false)).toBe(3);
    expect(dropGap([], 10, 0, false)).toBe(0);
  });

  it("picks the nearest row first when tabs wrap", () => {
    const wrapped = [
      ...row,
      { left: 0, right: 100, top: 30, bottom: 60 },
      { left: 100, right: 200, top: 30, bottom: 60 },
    ];
    expect(dropGap(wrapped, 120, 50, true)).toBe(4);
    expect(dropGap(wrapped, 250, 55, true)).toBe(5);
    expect(dropGap(wrapped, 250, 5, true)).toBe(3);
  });
});

describe("gapIndex", () => {
  it("counts the dragged tab's own slot out when moving right", () => {
    expect(gapIndex(3, 0)).toBe(2);
    expect(gapIndex(1, 2)).toBe(1);
    expect(gapIndex(2, 2)).toBe(2);
  });
});

describe("edgeScrollStep", () => {
  it("scrolls faster nearer the edge and not at all in the middle", () => {
    expect(edgeScrollStep(150, 0, 300)).toBe(0);
    expect(edgeScrollStep(0, 0, 300)).toBe(-EDGE_SCROLL_MAX_STEP);
    expect(edgeScrollStep(300, 0, 300)).toBe(EDGE_SCROLL_MAX_STEP);
    expect(edgeScrollStep(290, 0, 300)).toBeGreaterThan(0);
  });
});

describe("wheelScroll", () => {
  it("turns a vertical wheel into a sideways scroll, but not pinches or sideways wheels", () => {
    expect(wheelScroll({ deltaX: 0, deltaY: 40, ctrlKey: false, metaKey: false })).toBe(40);
    expect(wheelScroll({ deltaX: 0, deltaY: 40, ctrlKey: true, metaKey: false })).toBe(0);
    expect(wheelScroll({ deltaX: 30, deltaY: 10, ctrlKey: false, metaKey: false })).toBe(0);
  });
});
