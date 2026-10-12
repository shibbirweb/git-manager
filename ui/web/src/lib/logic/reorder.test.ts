import { describe, expect, it } from "vitest";
import { dropIndex, movedItems } from "./reorder";

describe("dropIndex", () => {
  const centers = [50, 150, 250, 350];

  it("finds the slot under the pointer, moving left or right", () => {
    expect(dropIndex(centers, 10, 2)).toBe(0);
    expect(dropIndex(centers, 200, 0)).toBe(1);
    expect(dropIndex(centers, 400, 0)).toBe(3);
    expect(dropIndex(centers, 260, 2)).toBe(2);
  });

  it("keeps the item without other items", () => {
    expect(dropIndex([], 10, 0)).toBe(0);
  });
});

describe("movedItems", () => {
  it("moves one item and keeps the rest in order", () => {
    expect(movedItems(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(movedItems(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(movedItems(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(movedItems(["a"], 5, 0)).toEqual(["a"]);
  });
});
