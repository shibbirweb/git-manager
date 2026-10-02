import { describe, expect, it } from "vitest";
import { rulerOffset } from "./ruler";

describe("rulerOffset", () => {
  it("places the margin line at the left edge of its column", () => {
    expect(rulerOffset(120, 7.8)).toBeCloseTo(936);
    expect(rulerOffset(0, 7.8)).toBe(0);
    expect(rulerOffset(-4, 7.8)).toBe(0);
  });
});
