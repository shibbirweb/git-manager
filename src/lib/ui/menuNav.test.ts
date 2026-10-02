import { describe, expect, it, vi } from "vitest";
import type { MenuItem } from "./menu.svelte";
import { firstIndex, hasSubmenu, isSelectable, lastIndex, matchIndex, rootPosition, stepIndex, submenuPosition } from "./menuNav";

const action = vi.fn();
const items: MenuItem[] = [
  { label: "Commit", submenu: [] },
  { separator: true },
  { label: "Changes", action, disabled: true },
  { label: "Checkout", action },
  { label: "Show Log", action },
];

describe("menu keyboard navigation", () => {
  it("skips separators and disabled items, wrapping around", () => {
    expect(firstIndex(items)).toBe(0);
    expect(lastIndex(items)).toBe(4);
    expect(stepIndex(items, 0, 1)).toBe(3);
    expect(stepIndex(items, 3, -1)).toBe(0);
    expect(stepIndex(items, 4, 1)).toBe(0);
    expect(stepIndex(items, 0, -1)).toBe(4);
    expect(stepIndex(items, -1, -1)).toBe(4);
  });

  it("finds nothing in an empty or fully disabled menu", () => {
    expect(firstIndex([])).toBe(-1);
    expect(stepIndex([{ separator: true }, { label: "x", action, disabled: true }], -1, 1)).toBe(-1);
  });

  it("jumps to the next item starting with a typed letter", () => {
    expect(matchIndex(items, -1, "c")).toBe(0);
    expect(matchIndex(items, 0, "c")).toBe(3);
    expect(matchIndex(items, 3, "C")).toBe(0);
    expect(matchIndex(items, 0, "s")).toBe(4);
    expect(matchIndex(items, 0, "z")).toBe(-1);
  });

  it("tells submenus and selectable items apart", () => {
    expect(hasSubmenu(items[0])).toBe(true);
    expect(hasSubmenu(items[3])).toBe(false);
    expect(isSelectable(items[1])).toBe(false);
    expect(isSelectable(items[2])).toBe(false);
    expect(isSelectable(undefined)).toBe(false);
  });
});

describe("menu placement", () => {
  const viewport = { width: 1000, height: 800 };
  const menu = { width: 200, height: 300 };

  it("opens a submenu to the right of its row", () => {
    expect(submenuPosition({ left: 100, right: 300, top: 50, bottom: 74 }, menu, viewport)).toEqual({ left: 298, top: 45 });
  });

  it("flips a submenu to the left at the window edge and keeps it on screen", () => {
    const row = { left: 700, right: 900, top: 700, bottom: 724 };
    expect(submenuPosition(row, menu, viewport)).toEqual({ left: 502, top: 496 });
  });

  it("keeps the root menu inside the window, optionally right-aligned", () => {
    expect(rootPosition(10, 20, menu, viewport, false)).toEqual({ left: 10, top: 20 });
    expect(rootPosition(950, 700, menu, viewport, false)).toEqual({ left: 796, top: 496 });
    expect(rootPosition(300, 20, menu, viewport, true)).toEqual({ left: 100, top: 20 });
    expect(rootPosition(100, 20, menu, viewport, true)).toEqual({ left: 4, top: 20 });
  });
});
