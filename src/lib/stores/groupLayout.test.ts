import { describe, expect, it } from "vitest";
import {
  clampSplitRatio,
  type GroupLayout,
  groupDirection,
  groupRects,
  keepInLayout,
  layoutGroupIds,
  layoutSplitters,
  leafLayout,
  parseGroupLayout,
  renameGroups,
  rowLayout,
  setSplitRatio,
  splitLayout,
} from "./groupLayout";

/** 0 on the left; 1 above 2 on the right. */
function grid(): GroupLayout {
  return splitLayout(splitLayout(leafLayout(0), 0, 1, "right"), 1, 2, "down");
}

describe("group layout", () => {
  it("splits a group, the new one taking the second side", () => {
    const layout = grid();
    expect(layoutGroupIds(layout)).toEqual([0, 1, 2]);
    expect(groupRects(layout)).toEqual(
      new Map([
        [0, { x: 0, y: 0, width: 0.5, height: 1 }],
        [1, { x: 0.5, y: 0, width: 0.5, height: 0.5 }],
        [2, { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }],
      ]),
    );
    expect(splitLayout(layout, 9, 3, "down")).toBe(layout);
  });

  it("gives a removed group's room to the other side of its split", () => {
    const layout = grid();
    const withoutTop = keepInLayout(layout, new Set([0, 2]));
    expect(withoutTop && groupRects(withoutTop).get(2)).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 });
    expect(keepInLayout(layout, new Set([0, 1, 2]))).toBe(layout);
    expect(keepInLayout(layout, new Set())).toBeNull();
  });

  it("moves one splitter by its path, inside the allowed range", () => {
    const layout = setSplitRatio(grid(), "1", 0.25);
    expect(groupRects(layout).get(2)).toEqual({ x: 0.5, y: 0.25, width: 0.5, height: 0.75 });
    expect(layoutSplitters(setSplitRatio(grid(), "", 0.99))[0].ratio).toBe(0.9);
    expect(clampSplitRatio(Number.NaN)).toBe(0.5);
  });

  it("lists every splitter with the area it divides", () => {
    expect(layoutSplitters(grid())).toEqual([
      { path: "", direction: "right", ratio: 0.5, rect: { x: 0, y: 0, width: 1, height: 1 } },
      { path: "1", direction: "down", ratio: 0.5, rect: { x: 0.5, y: 0, width: 0.5, height: 1 } },
    ]);
    expect(layoutSplitters(leafLayout(0))).toEqual([]);
  });

  it("tells which way one group lies from another", () => {
    const layout = grid();
    expect(groupDirection(layout, 0, 1)).toBe("right");
    expect(groupDirection(layout, 1, 0)).toBe("left");
    expect(groupDirection(layout, 1, 2)).toBe("down");
    expect(groupDirection(layout, 2, 1)).toBe("up");
    expect(groupDirection(layout, 0, 7)).toBeNull();
  });

  it("puts groups side by side at equal widths", () => {
    const rects = groupRects(rowLayout([0, 1, 2]));
    expect(rects.get(1)?.x).toBeCloseTo(1 / 3);
    expect(rects.get(2)?.width).toBeCloseTo(1 / 3);
    expect(rowLayout([])).toEqual(leafLayout(0));
  });

  it("reads a saved layout only when it holds each group once", () => {
    const layout = grid();
    expect(parseGroupLayout(JSON.parse(JSON.stringify(layout)), 3)).toEqual(layout);
    expect(parseGroupLayout(layout, 2)).toBeNull();
    expect(parseGroupLayout({ kind: "split", direction: "down", first: leafLayout(0), second: leafLayout(0) }, 1)).toBeNull();
    expect(parseGroupLayout({ kind: "split", direction: "sideways", first: leafLayout(0), second: leafLayout(1) }, 2)).toBeNull();
    expect(parseGroupLayout({ kind: "split", direction: "down", ratio: "wide", first: leafLayout(0), second: leafLayout(1) }, 2)).toEqual({
      kind: "split",
      direction: "down",
      ratio: 0.5,
      first: leafLayout(0),
      second: leafLayout(1),
    });
    expect(parseGroupLayout("nonsense", 1)).toBeNull();
  });

  it("renames groups", () => {
    expect(layoutGroupIds(renameGroups(grid(), (groupId) => groupId + 10))).toEqual([10, 11, 12]);
  });
});
