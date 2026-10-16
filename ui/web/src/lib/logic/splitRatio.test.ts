import { describe, expect, it } from "vitest";
import { clampRatio, keyedRatio, pointerRatio } from "./splitRatio";

describe("split ratio", () => {
  it("follows the pointer and keeps both sides visible", () => {
    expect(pointerRatio(300, 100, 400)).toBe(0.5);
    expect(pointerRatio(100, 100, 400)).toBe(0.15);
    expect(pointerRatio(600, 100, 400)).toBe(0.85);
    expect(pointerRatio(300, 100, 0)).toBe(0.5);
  });

  it("leaves the gutter between the sides out of the shared width", () => {
    expect(pointerRatio(288, 100, 400, 24)).toBe(0.5);
    expect(pointerRatio(300, 100, 24, 24)).toBe(0.5);
  });

  it("moves by key, further with Shift", () => {
    expect(keyedRatio(0.5, "ArrowLeft", false)).toBeCloseTo(0.48);
    expect(keyedRatio(0.5, "ArrowRight", true)).toBeCloseTo(0.6);
    expect(keyedRatio(0.5, "Enter", false)).toBeNull();
    expect(clampRatio(2)).toBe(0.85);
  });
});
