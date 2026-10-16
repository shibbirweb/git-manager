import { describe, expect, it } from "vitest";
import { columnsFor, isAtOrBelow, panelSize, windowSize } from "./breakpoints";

describe("breakpoints", () => {
  it("names window widths at the token breakpoints", () => {
    expect(windowSize(800)).toBe("compact");
    expect(windowSize(900)).toBe("regular");
    expect(windowSize(1599)).toBe("regular");
    expect(windowSize(1600)).toBe("wide");
  });

  it("names panel widths", () => {
    expect(panelSize(200)).toBe("tiny");
    expect(panelSize(300)).toBe("narrow");
    expect(panelSize(400)).toBe("compact");
    expect(panelSize(500)).toBe("medium");
    expect(panelSize(700)).toBe("wide");
  });

  it("fits grid columns of a minimum width", () => {
    expect(columnsFor(600, 180, 16)).toBe(3);
    expect(columnsFor(100, 180, 16)).toBe(1);
    expect(columnsFor(5000, 180, 16, 4)).toBe(4);
    expect(columnsFor(0, 180, 16)).toBe(1);
  });
});

describe("isAtOrBelow", () => {
  it("steps aside at the named width or narrower, never in an unmeasured bar", () => {
    expect(isAtOrBelow(panelSize(590), "medium")).toBe(true);
    expect(isAtOrBelow(panelSize(600), "medium")).toBe(false);
    expect(isAtOrBelow(panelSize(470), "compact")).toBe(true);
    expect(isAtOrBelow(panelSize(500), "compact")).toBe(false);
    expect(isAtOrBelow(panelSize(200), "narrow")).toBe(true);
    expect(isAtOrBelow(panelSize(210), "tiny")).toBe(true);
    expect(isAtOrBelow(panelSize(220), "tiny")).toBe(false);
    expect(isAtOrBelow(null, "medium")).toBe(false);
    expect(isAtOrBelow("tiny", null)).toBe(false);
  });
});
