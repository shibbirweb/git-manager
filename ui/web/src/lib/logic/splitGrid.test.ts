import { describe, expect, it } from "vitest";
import { groupBox, innerEdges, splitterBox } from "./splitGrid";

describe("split grid", () => {
  it("knows which edges touch another group", () => {
    expect(innerEdges({ x: 0, y: 0, width: 0.5, height: 1 })).toEqual({
      left: false,
      top: false,
      right: true,
      bottom: false,
    });
    expect(innerEdges({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 })).toEqual({
      left: true,
      top: true,
      right: false,
      bottom: false,
    });
  });

  it("keeps half a gap on inner edges only", () => {
    const box = groupBox({ x: 0.5, y: 0, width: 0.5, height: 1 });
    expect(box.left).toBe("calc(50% + var(--split-grid-gap-half))");
    expect(box.width).toBe("calc(50% - var(--split-grid-gap-half) - 0px)");
    expect(box.top).toBe("calc(0% + 0px)");
  });

  it("places a splitter across its split", () => {
    const rect = { x: 0, y: 0, width: 1, height: 0.5 };
    expect(splitterBox({ id: "a", direction: "right", rect, ratio: 0.25 })).toEqual({
      left: "25%",
      top: "0%",
      height: "50%",
    });
    expect(splitterBox({ id: "b", direction: "down", rect, ratio: 0.5 })).toEqual({
      top: "25%",
      left: "0%",
      width: "100%",
    });
  });
});
