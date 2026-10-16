import { describe, expect, it } from "vitest";
import { movedOffset } from "./dialogMove";

const start = { pointerX: 100, pointerY: 100, x: 0, y: 0, left: 200, top: 100, width: 400 };
const viewport = { width: 1000, height: 800 };

describe("moving a dialog", () => {
  it("follows the pointer", () => {
    expect(movedOffset(start, 130, 90, viewport, 60)).toEqual({ x: 30, y: -10 });
  });

  it("adds to the offset it already had", () => {
    expect(movedOffset({ ...start, x: 20, y: 5 }, 110, 110, viewport, 60)).toEqual({ x: 30, y: 15 });
  });

  it("keeps part of it on screen to the right and left", () => {
    expect(movedOffset(start, 2000, 100, viewport, 60).x).toBe(740);
    expect(movedOffset(start, -2000, 100, viewport, 60).x).toBe(-540);
  });

  it("never moves its title above the window or below the bottom edge", () => {
    expect(movedOffset(start, 100, -500, viewport, 60).y).toBe(-100);
    expect(movedOffset(start, 100, 2000, viewport, 60).y).toBe(640);
  });
});
