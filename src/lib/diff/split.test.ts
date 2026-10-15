import { describe, expect, it } from "vitest";
import { clampDiffSplit, DEFAULT_DIFF_SPLIT, DIFF_SPLIT_RANGE } from "./split";

describe("diff split", () => {
  it("keeps the split inside its range", () => {
    expect(clampDiffSplit(0.4)).toBe(0.4);
    expect(clampDiffSplit(0)).toBe(DIFF_SPLIT_RANGE[0]);
    expect(clampDiffSplit(2)).toBe(DIFF_SPLIT_RANGE[1]);
    expect(clampDiffSplit(Number.NaN)).toBe(DEFAULT_DIFF_SPLIT);
  });
});
