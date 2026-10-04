import { describe, expect, it } from "vitest";
import {
  canvasShift,
  lineAtMinimapY,
  lineRuns,
  MINIMAP_ROW,
  minimapLayout,
  paintWindow,
  topLineForClick,
  topLineForDrag,
  windowCovers,
} from "./minimapModel";

describe("minimap layout", () => {
  it("draws a short file whole from the top", () => {
    const layout = minimapLayout({ lineCount: 100, topLine: 20, visibleLines: 40, height: 600 });
    expect(layout.firstLine).toBe(0);
    expect(layout.lineCount).toBe(100);
    expect(layout.offset).toBe(0);
    expect(layout.sliderTop).toBe(20 * MINIMAP_ROW);
    expect(layout.sliderHeight).toBe(40 * MINIMAP_ROW);
  });

  it("scrolls a long file so its ends meet the minimap's ends", () => {
    const top = minimapLayout({ lineCount: 20_000, topLine: 0, visibleLines: 50, height: 600 });
    expect(top.firstLine).toBe(0);
    expect(top.sliderTop).toBe(0);
    expect(top.lineCount).toBe(301);
    const end = minimapLayout({ lineCount: 20_000, topLine: 19_950, visibleLines: 50, height: 600 });
    expect(end.sliderTop + end.sliderHeight).toBeCloseTo(600);
    expect(end.firstLine).toBe(20_000 - 300);
    const middle = minimapLayout({ lineCount: 20_000, topLine: 9_975, visibleLines: 50, height: 600 });
    expect(middle.sliderTop).toBeCloseTo((600 - middle.sliderHeight) / 2);
  });

  it("finds the line under a click and centers it", () => {
    const layout = minimapLayout({ lineCount: 100, topLine: 0, visibleLines: 20, height: 600 });
    expect(lineAtMinimapY(layout, 51, 100)).toBe(25);
    expect(lineAtMinimapY(layout, 5000, 100)).toBe(99);
    expect(topLineForClick(layout, 100, 100, 20)).toBe(40);
    expect(topLineForClick(layout, 2, 100, 20)).toBe(0);
    expect(topLineForClick(layout, 199, 100, 20)).toBe(80);
  });

  it("moves the slider with the pointer while dragging", () => {
    // A short file: one minimap row per line.
    expect(topLineForDrag(10, 2 * MINIMAP_ROW, 100, 20, 600)).toBeCloseTo(12);
    // A long file: the slider's track is the minimap's height.
    const track = 600 - 50 * MINIMAP_ROW;
    expect(topLineForDrag(0, track, 20_000, 50, 600)).toBe(19_950);
    expect(topLineForDrag(0, -10, 20_000, 50, 600)).toBe(0);
    expect(topLineForDrag(0, 10, 10, 50, 600)).toBe(0);
  });
});

describe("minimap line runs", () => {
  it("joins characters of one style and leaves spaces out", () => {
    const styles = [{ from: 10, to: 15, className: "tok-keyword" }];
    expect(lineRuns("const a = 1", 10, styles, 4, 100)).toEqual([
      { column: 0, length: 5, className: "tok-keyword" },
      { column: 6, length: 1, className: "" },
      { column: 8, length: 1, className: "" },
      { column: 10, length: 1, className: "" },
    ]);
  });

  it("expands tabs and stops at the width", () => {
    expect(lineRuns("\tab", 0, [], 4, 100)).toEqual([{ column: 4, length: 2, className: "" }]);
    expect(lineRuns("abcdef", 0, [], 4, 3)).toEqual([{ column: 0, length: 3, className: "" }]);
  });
});

describe("minimap paint window", () => {
  it("paints a margin around the shown lines and moves the canvas inside it", () => {
    const layout = minimapLayout({ lineCount: 20_000, topLine: 10_000, visibleLines: 50, height: 600 });
    const painted = paintWindow(layout, 20_000, 100);
    expect(painted.firstLine).toBe(layout.firstLine - 100);
    expect(painted.lineCount).toBe(layout.lineCount + 200);
    expect(windowCovers(painted, layout)).toBe(true);
    expect(canvasShift(painted, layout)).toBeCloseTo(100 * MINIMAP_ROW + layout.offset);
    // A little scrolling stays inside; a long jump needs a new paint.
    expect(windowCovers(painted, minimapLayout({ lineCount: 20_000, topLine: 10_100, visibleLines: 50, height: 600 }))).toBe(true);
    expect(windowCovers(painted, minimapLayout({ lineCount: 20_000, topLine: 15_000, visibleLines: 50, height: 600 }))).toBe(false);
    expect(windowCovers(null, layout)).toBe(false);
  });

  it("keeps the window inside the file", () => {
    const layout = minimapLayout({ lineCount: 80, topLine: 0, visibleLines: 50, height: 600 });
    expect(paintWindow(layout, 80, 100)).toEqual({ firstLine: 0, lineCount: 80 });
  });
});
