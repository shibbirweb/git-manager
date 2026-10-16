import { describe, expect, it } from "vitest";
import { rulerOffset, rulerSpan } from "./ruler";

describe("rulerOffset", () => {
  it("places the margin line at the left edge of its column", () => {
    expect(rulerOffset(120, 7.8)).toBeCloseTo(936);
    expect(rulerOffset(0, 7.8)).toBe(0);
    expect(rulerOffset(-4, 7.8)).toBe(0);
  });
});

describe("rulerSpan", () => {
  it("covers only the drawn lines of a long file", () => {
    expect(rulerSpan(12_000, 15_000, 12_800, 900)).toEqual({ top: 12_000, height: 3_000 });
  });

  it("reaches the bottom of the editor in a short file", () => {
    expect(rulerSpan(4, 200, 0, 900)).toEqual({ top: 0, height: 900 });
  });
});
