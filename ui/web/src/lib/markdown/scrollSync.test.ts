import { describe, expect, it } from "vitest";
import { buildAnchors, lineForOffset, offsetForLine } from "./scrollSync";

describe("scroll sync", () => {
  const anchors = buildAnchors([
    { line: 0, top: 0 },
    { line: 0, top: 10 },
    { line: 10, top: 200 },
    { line: 10, top: 210 },
    { line: 8, top: 300 },
    { line: 20, top: 400 },
  ]);

  it("keeps anchors with increasing lines only", () => {
    expect(anchors).toEqual([
      { line: 0, top: 0 },
      { line: 10, top: 200 },
      { line: 20, top: 400 },
    ]);
  });

  it("interpolates between blocks and to the end", () => {
    expect(offsetForLine(anchors, 0, 40, 1000)).toBe(0);
    expect(offsetForLine(anchors, 5, 40, 1000)).toBe(100);
    expect(offsetForLine(anchors, 15, 40, 1000)).toBe(300);
    expect(offsetForLine(anchors, 30, 40, 1000)).toBe(700);
    expect(offsetForLine(anchors, 99, 40, 1000)).toBe(1000);
  });

  it("maps offsets back to the same lines", () => {
    for (const line of [0, 3, 10, 17.5, 33]) {
      expect(lineForOffset(anchors, offsetForLine(anchors, line, 40, 1000), 40, 1000)).toBeCloseTo(line);
    }
  });

  it("adds the document start when the first block is further down", () => {
    const late = buildAnchors([{ line: 4, top: 80 }]);
    expect(offsetForLine(late, 2, 10, 200)).toBe(40);
    expect(lineForOffset(late, 140, 10, 200)).toBe(7);
  });

  it("falls back to proportions without blocks", () => {
    expect(offsetForLine([], 25, 100, 400)).toBe(100);
    expect(lineForOffset([], 200, 100, 400)).toBe(50);
  });
});
