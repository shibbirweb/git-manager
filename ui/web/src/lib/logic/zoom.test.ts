import { describe, expect, it } from "vitest";
import { fitZoom, nextZoom, sharedFit, syncedScroll, zoomLabel } from "./zoom";

describe("zoom", () => {
  it("steps to the next level, also from between steps, and stops at the ends", () => {
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(0.6, 1)).toBe(0.75);
    expect(nextZoom(0.6, -1)).toBe(0.5);
    expect(nextZoom(8, 1)).toBe(8);
    expect(nextZoom(0.1, -1)).toBe(0.1);
  });

  it("fits big images and keeps small ones at their size", () => {
    expect(fitZoom({ width: 2000, height: 1000 }, 500, 500)).toBe(0.25);
    expect(fitZoom({ width: 100, height: 100 }, 500, 500)).toBe(1);
    expect(fitZoom(null, 500, 500)).toBe(1);
    expect(fitZoom({ width: 100, height: 100 }, 0, 500)).toBe(1);
  });

  it("fits both compared images with one zoom", () => {
    expect(sharedFit([{ width: 1000, height: 100 }, { width: 400, height: 400 }], 200, 200)).toBe(0.2);
    expect(sharedFit([null, { width: 400, height: 400 }], 200, 200)).toBe(0.5);
    expect(sharedFit([null, null], 200, 200)).toBe(1);
  });

  it("labels zoom in whole percents", () => {
    expect(zoomLabel(0.333)).toBe("33%");
  });

  it("keeps two scroll boxes at the same place in proportion", () => {
    const box = { scrollTop: 0, scrollHeight: 100, clientWidth: 100, clientHeight: 100 };
    const from = { ...box, scrollLeft: 50, scrollWidth: 200 };
    const to = { ...box, scrollLeft: 0, scrollWidth: 400 };
    expect(syncedScroll(from, to)).toEqual({ left: 150, top: 0 });
  });
});
