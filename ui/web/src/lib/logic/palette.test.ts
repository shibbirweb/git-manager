import { describe, expect, it } from "vitest";
import { PALETTE_PAGE, paletteMove, paletteStep } from "./palette";

const key = (name: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key: name,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("paletteStep", () => {
  it("moves one row with the arrows and Ctrl+N / Ctrl+P", () => {
    expect(paletteStep(key("ArrowDown"))).toBe(1);
    expect(paletteStep(key("ArrowUp"))).toBe(-1);
    expect(paletteStep(key("n", { ctrlKey: true }))).toBe(1);
    expect(paletteStep(key("p", { ctrlKey: true }))).toBe(-1);
  });

  it("moves a page with Page Down and Page Up", () => {
    expect(paletteStep(key("PageDown"))).toBe(PALETTE_PAGE);
    expect(paletteStep(key("PageUp"))).toBe(-PALETTE_PAGE);
  });

  it("leaves typing alone, Cmd+N and Ctrl+Shift+P included", () => {
    expect(paletteStep(key("n"))).toBe(0);
    expect(paletteStep(key("n", { metaKey: true }))).toBe(0);
    expect(paletteStep(key("p", { ctrlKey: true, shiftKey: true }))).toBe(0);
  });
});

describe("paletteMove", () => {
  it("wraps single steps around the ends", () => {
    expect(paletteMove(0, 3, 1)).toBe(1);
    expect(paletteMove(2, 3, 1)).toBe(0);
    expect(paletteMove(0, 3, -1)).toBe(2);
  });

  it("stops page steps at the ends", () => {
    expect(paletteMove(1, 3, 10)).toBe(2);
    expect(paletteMove(1, 3, -10)).toBe(0);
  });

  it("has nowhere to go without rows", () => {
    expect(paletteMove(-1, 0, 1)).toBe(-1);
  });
});
