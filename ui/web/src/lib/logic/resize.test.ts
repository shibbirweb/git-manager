import { describe, expect, it } from "vitest";
import { clampSize, draggedSize, keyedSize } from "./resize";

describe("resizing", () => {
  it("keeps sizes between min and max, rounded", () => {
    expect(clampSize(99.6, 100, 400)).toBe(100);
    expect(clampSize(250.4, 100, 400)).toBe(250);
    expect(clampSize(900, 100, 400)).toBe(400);
  });

  it("grows a left panel to the right, others towards the start", () => {
    expect(draggedSize("left", 200, 30, 100, 400)).toBe(230);
    expect(draggedSize("right", 200, 30, 100, 400)).toBe(170);
    expect(draggedSize("bottom", 200, -50, 100, 400)).toBe(250);
  });

  it("moves 10px per arrow key, 40px with Shift, and ignores other keys", () => {
    expect(keyedSize("left", "ArrowRight", false, 200, 100, 400)).toBe(210);
    expect(keyedSize("right", "ArrowLeft", true, 200, 100, 400)).toBe(240);
    expect(keyedSize("bottom", "ArrowDown", false, 105, 100, 400)).toBe(100);
    expect(keyedSize("left", "ArrowUp", false, 200, 100, 400)).toBeNull();
  });
});
