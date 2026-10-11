import { describe, expect, it } from "vitest";
import { canHighlight, placeMenu, stepHighlight, type MenuItem } from "./menuModel";

const run = () => undefined;
const items: MenuItem[] = [
  { label: "Open", action: run },
  { separator: true },
  { label: "Rename", action: run, disabled: true },
  { label: "Copy", submenu: [{ label: "Path", action: run }] },
  { label: "Delete", action: run, danger: true },
];

describe("stepHighlight", () => {
  it("skips separators and disabled items, and wraps", () => {
    expect(stepHighlight(items, -1, 1)).toBe(0);
    expect(stepHighlight(items, 0, 1)).toBe(3);
    expect(stepHighlight(items, 4, 1)).toBe(0);
    expect(stepHighlight(items, 0, -1)).toBe(4);
  });

  it("is -1 when nothing can be highlighted", () => {
    expect(stepHighlight([{ separator: true }], -1, 1)).toBe(-1);
    expect(stepHighlight([], -1, 1)).toBe(-1);
  });

  it("knows which items can be highlighted", () => {
    expect(items.map(canHighlight)).toEqual([true, false, false, true, true]);
  });
});

describe("placeMenu", () => {
  const viewport = { width: 800, height: 600 };

  it("opens at the point when it fits", () => {
    expect(placeMenu(100, 100, 200, 150, viewport)).toEqual({ left: 100, top: 100 });
  });

  it("keeps inside the right and bottom edges", () => {
    expect(placeMenu(750, 550, 200, 150, viewport)).toEqual({ left: 596, top: 446 });
  });

  it("aligns its right edge with the point when asked", () => {
    expect(placeMenu(300, 10, 200, 100, viewport, true)).toEqual({ left: 100, top: 10 });
    expect(placeMenu(100, 10, 200, 100, viewport, true)).toEqual({ left: 4, top: 10 });
  });
});
