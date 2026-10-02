import { describe, expect, it } from "vitest";
import { clampDiffSplit, DEFAULT_DIFF_SPLIT, DIFF_SPLIT_RANGE, splitFromPointer } from "./split";

describe("diff split", () => {
  it("keeps the split inside its range", () => {
    expect(clampDiffSplit(0.4)).toBe(0.4);
    expect(clampDiffSplit(0)).toBe(DIFF_SPLIT_RANGE[0]);
    expect(clampDiffSplit(2)).toBe(DIFF_SPLIT_RANGE[1]);
    expect(clampDiffSplit(Number.NaN)).toBe(DEFAULT_DIFF_SPLIT);
  });

  it("turns a pointer position into the left side's share, leaving out the arrows column", () => {
    expect(splitFromPointer(300, 100, 824, 24)).toBe(0.25);
    expect(splitFromPointer(500, 100, 800, 0)).toBe(0.5);
    expect(splitFromPointer(50, 100, 800, 0)).toBe(DIFF_SPLIT_RANGE[0]);
    expect(splitFromPointer(500, 100, 10, 24)).toBe(DEFAULT_DIFF_SPLIT);
  });
});
