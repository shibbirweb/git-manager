import { describe, expect, it } from "vitest";
import { dropGap, edgeScrollStep, type TabBox } from "./tabDrag";

function row(top: number, ...widths: number[]): TabBox[] {
  let left = 0;
  return widths.map((width) => {
    const box = { left, right: left + width, top, bottom: top + 34 };
    left += width;
    return box;
  });
}

describe("dropGap", () => {
  const single = row(0, 100, 100, 100);

  it("picks the gap by the middles of the tabs in one row", () => {
    expect(dropGap(single, -20, 0, false)).toBe(0);
    expect(dropGap(single, 40, 0, false)).toBe(0);
    expect(dropGap(single, 60, 0, false)).toBe(1);
    expect(dropGap(single, 160, 0, false)).toBe(2);
    expect(dropGap(single, 900, 0, false)).toBe(3);
  });

  it("ignores the height in a single row", () => {
    expect(dropGap(single, 160, 500, false)).toBe(2);
  });

  it("uses the pointer's row, or the nearest one, when tabs wrap", () => {
    const boxes = [...row(0, 100, 100), ...row(34, 100, 100)];
    expect(dropGap(boxes, 160, 10, true)).toBe(2);
    expect(dropGap(boxes, 40, 50, true)).toBe(2);
    expect(dropGap(boxes, 160, 50, true)).toBe(4);
    expect(dropGap(boxes, 40, 300, true)).toBe(2);
    expect(dropGap(boxes, 40, -50, true)).toBe(0);
  });

  it("is 0 with no tabs", () => {
    expect(dropGap([], 10, 10, true)).toBe(0);
  });
});

describe("edgeScrollStep", () => {
  it("scrolls near the edges only, faster closer to them", () => {
    expect(edgeScrollStep(200, 0, 400)).toBe(0);
    expect(edgeScrollStep(20, 0, 400)).toBeLessThan(0);
    expect(edgeScrollStep(0, 0, 400)).toBe(-12);
    expect(edgeScrollStep(395, 0, 400)).toBeGreaterThan(0);
    expect(edgeScrollStep(500, 0, 400)).toBe(12);
  });
});
