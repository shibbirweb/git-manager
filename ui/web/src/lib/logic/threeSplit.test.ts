import { describe, expect, it } from "vitest";
import { EVEN_THREE_SPLIT, MIN_PANE_SHARE, moveThreeSplit, readThreeSplit } from "./threeSplit";

describe("three split", () => {
  it("moves one boundary and leaves the other", () => {
    expect(moveThreeSplit([0.3, 0.7], 0, 0.4)).toEqual([0.4, 0.7]);
    expect(moveThreeSplit([0.3, 0.7], 1, 0.6)).toEqual([0.3, 0.6]);
  });

  it("keeps every pane its minimum share", () => {
    expect(moveThreeSplit([0.3, 0.7], 0, 0)).toEqual([MIN_PANE_SHARE, 0.7]);
    expect(moveThreeSplit([0.3, 0.7], 0, 0.69)[0]).toBeCloseTo(0.7 - MIN_PANE_SHARE);
    expect(moveThreeSplit([0.3, 0.7], 1, 0.31)[1]).toBeCloseTo(0.3 + MIN_PANE_SHARE);
    expect(moveThreeSplit([0.3, 0.7], 1, 1)[1]).toBeCloseTo(1 - MIN_PANE_SHARE);
  });

  it("ignores a ratio that is not a number", () => {
    expect(moveThreeSplit([0.3, 0.7], 0, Number.NaN)).toEqual([0.3, 0.7]);
  });

  it("reads a saved split, or falls back to even thirds", () => {
    expect(readThreeSplit([0.2, 0.6])).toEqual([0.2, 0.6]);
    expect(readThreeSplit(EVEN_THREE_SPLIT)).toEqual(EVEN_THREE_SPLIT);
    expect(readThreeSplit(undefined)).toEqual(EVEN_THREE_SPLIT);
    expect(readThreeSplit([0.5])).toEqual(EVEN_THREE_SPLIT);
    expect(readThreeSplit(["0.2", 0.6])).toEqual(EVEN_THREE_SPLIT);
    expect(readThreeSplit([0.05, 0.6])).toEqual(EVEN_THREE_SPLIT);
    expect(readThreeSplit([0.5, 0.55])).toEqual(EVEN_THREE_SPLIT);
    expect(readThreeSplit([0.3, 0.95])).toEqual(EVEN_THREE_SPLIT);
    expect(readThreeSplit([0.3, Number.POSITIVE_INFINITY])).toEqual(EVEN_THREE_SPLIT);
  });
});
