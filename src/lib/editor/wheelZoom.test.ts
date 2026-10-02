import { describe, expect, it } from "vitest";
import { steppedFontSize, WheelZoom } from "./wheelZoom";

describe("WheelZoom", () => {
  it("grows when scrolling up and shrinks when scrolling down", () => {
    const zoom = new WheelZoom();
    expect(zoom.apply(13, -100)).toBe(14);
    expect(zoom.apply(14, 100)).toBe(13);
  });

  it("accumulates small trackpad deltas", () => {
    const zoom = new WheelZoom();
    expect(zoom.apply(13, -20)).toBe(13);
    expect(zoom.apply(13, -20)).toBe(13);
    expect(zoom.apply(13, -20)).toBe(13.5);
  });

  it("treats line-based deltas as about 40 pixels per line", () => {
    expect(new WheelZoom().apply(13, -3, 1)).toBe(14);
  });

  it("stops at the limits", () => {
    const zoom = new WheelZoom();
    expect(zoom.apply(19.5, -1000)).toBe(20);
    expect(zoom.apply(10, 1000)).toBe(10);
  });
});

describe("steppedFontSize", () => {
  it("steps one pixel on the half-pixel grid", () => {
    expect(steppedFontSize(12.5, 1)).toBe(13.5);
    expect(steppedFontSize(12.5, -1)).toBe(11.5);
    expect(steppedFontSize(13.25, 1)).toBe(14.5);
  });

  it("stays within the editor font sizes", () => {
    expect(steppedFontSize(20, 1)).toBe(20);
    expect(steppedFontSize(10, -1)).toBe(10);
  });
});
