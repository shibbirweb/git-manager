import { describe, expect, it } from "vitest";
import { crumbPlace, crumbShrink } from "./crumbs";

const sizes = { width: 340, maxHeight: 440, minHeight: 120, offset: 3, inset: 8, roomBelow: 200 };
const crumb = (top: number, left = 100) => ({ left, right: left + 60, top, bottom: top + 22 });

describe("crumbShrink", () => {
  it("lets the farthest crumbs give way first and the file last", () => {
    expect(crumbShrink(3, 4)).toBe(1);
    expect(crumbShrink(2, 4)).toBe(10);
    expect(crumbShrink(0, 4)).toBe(1000);
    expect(crumbShrink(0, 20)).toBe(1_000_000);
  });
});

describe("crumbPlace", () => {
  it("opens under a crumb near the top of the window", () => {
    const place = crumbPlace(crumb(40), { width: 1200, height: 800 }, sizes);
    expect(place).toMatchObject({ top: 65, bottom: null, left: 96, width: 340, maxHeight: 440 });
  });

  it("opens above a crumb at the bottom of the window", () => {
    const place = crumbPlace(crumb(770), { width: 1200, height: 800 }, sizes);
    expect(place.top).toBeNull();
    expect(place.bottom).toBe(33);
    expect(place.maxHeight).toBe(440);
  });

  it("stays inside a narrow window", () => {
    const place = crumbPlace(crumb(40, 280), { width: 300, height: 800 }, sizes);
    expect(place.width).toBe(284);
    expect(place.left).toBe(8);
  });
});
