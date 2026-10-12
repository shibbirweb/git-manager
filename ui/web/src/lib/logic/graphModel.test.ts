import { describe, expect, it } from "vitest";
import { graphPaths, graphWidth, laneColor, laneX, SEGMENT_IN, SEGMENT_OUT, SEGMENT_PASS } from "./graphModel";

describe("the graph", () => {
  it("places lanes like the app's GraphCell", () => {
    expect(laneX(0)).toBe(9);
    expect(laneX(2)).toBe(37);
    expect(graphWidth(1)).toBe(18);
    expect(graphWidth(3)).toBe(46);
    expect(graphWidth(99)).toBe(graphWidth(24));
  });

  it("cycles lane colors through the palette", () => {
    expect(laneColor(0)).toBe("var(--palette-graph-lane-1)");
    expect(laneColor(9)).toBe("var(--palette-graph-lane-2)");
    expect(laneColor(-1)).toBe("var(--palette-graph-lane-8)");
  });

  it("draws pass, in and out lines, curving between lanes", () => {
    const row = { lane: 0, color: 0, edges: [SEGMENT_PASS, 1, 1, 1, SEGMENT_IN, 0, 0, 0, SEGMENT_OUT, 0, 1, 2] };
    expect(graphPaths(row, 26)).toEqual([
      { d: "M23 0V26", color: "var(--palette-graph-lane-2)" },
      { d: "M9 0V13", color: "var(--palette-graph-lane-1)" },
      { d: "M9 13C9 26 23 13 23 26", color: "var(--palette-graph-lane-3)" },
    ]);
  });
});
