import { describe, expect, it } from "vitest";
import { isListKey, moveIndex, PAGE_ROWS, parentIndex, treeMove } from "./listNav";

describe("moveIndex", () => {
  const heading = (index: number) => index === 0 || index === 4;

  it("steps over rows that cannot be picked", () => {
    expect(moveIndex(3, 8, "ArrowDown", heading)).toBe(5);
    expect(moveIndex(5, 8, "ArrowUp", heading)).toBe(3);
  });

  it("stops at the ends instead of wrapping", () => {
    expect(moveIndex(7, 8, "ArrowDown", heading)).toBe(7);
    expect(moveIndex(1, 8, "ArrowUp", heading)).toBe(1);
  });

  it("starts at the first pickable row when nothing is selected, End goes to the last", () => {
    expect(moveIndex(-1, 8, "ArrowDown", heading)).toBe(1);
    expect(moveIndex(-1, 8, "ArrowUp", heading)).toBe(1);
    expect(moveIndex(-1, 8, "End", heading)).toBe(7);
    expect(moveIndex(6, 8, "Home", heading)).toBe(1);
  });

  it("moves a page, clamped to the list", () => {
    expect(moveIndex(0, 30, "PageDown")).toBe(PAGE_ROWS);
    expect(moveIndex(25, 30, "PageDown")).toBe(29);
    expect(moveIndex(3, 30, "PageUp")).toBe(0);
  });

  it("finds nothing in a list with no pickable rows", () => {
    expect(moveIndex(-1, 2, "ArrowDown", () => true)).toBe(-1);
    expect(moveIndex(-1, 0, "ArrowDown")).toBe(-1);
  });

  it("knows its keys", () => {
    expect(isListKey("PageDown")).toBe(true);
    expect(isListKey("ArrowLeft")).toBe(false);
  });
});

describe("tree keys", () => {
  // root, child, grandchild, child, root
  const levels = [0, 1, 2, 1, 0];

  it("finds a row's parent", () => {
    expect(parentIndex(levels, 2)).toBe(1);
    expect(parentIndex(levels, 3)).toBe(0);
    expect(parentIndex(levels, 4)).toBe(-1);
  });

  it("Right opens a closed row, then moves to its first child", () => {
    expect(treeMove("ArrowRight", 0, false, levels)).toEqual({ kind: "toggle", open: true });
    expect(treeMove("ArrowRight", 0, true, levels)).toEqual({ kind: "move", index: 1 });
    expect(treeMove("ArrowRight", 3, null, levels)).toBeNull();
  });

  it("Left closes an open row, else moves to its parent", () => {
    expect(treeMove("ArrowLeft", 1, true, levels)).toEqual({ kind: "toggle", open: false });
    expect(treeMove("ArrowLeft", 2, null, levels)).toEqual({ kind: "move", index: 1 });
    expect(treeMove("ArrowLeft", 0, false, levels)).toBeNull();
  });
});
