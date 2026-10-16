import { describe, expect, it } from "vitest";
import { drivenSelection, fieldAction } from "./listField";
import { isAtBottom, isNearEnd, NEAR_END_PX } from "./listScroll";

describe("fieldAction", () => {
  it("moves the focus into the list on Down or Enter with enter", () => {
    expect(fieldAction("ArrowDown", "enter", false)).toEqual({ kind: "enter" });
    expect(fieldAction("Enter", "enter", false)).toEqual({ kind: "enter" });
    expect(fieldAction("ArrowUp", "enter", false)).toBeNull();
    expect(fieldAction("a", "enter", false)).toBeNull();
  });

  it("moves the highlight and opens the row with drive, leaving Home, End and letters to the field", () => {
    expect(fieldAction("ArrowUp", "drive", false)).toEqual({ kind: "move", key: "ArrowUp" });
    expect(fieldAction("PageDown", "drive", false)).toEqual({ kind: "move", key: "PageDown" });
    expect(fieldAction("Enter", "drive", false)).toEqual({ kind: "activate" });
    expect(fieldAction("Home", "drive", false)).toBeNull();
    expect(fieldAction("End", "drive", false)).toBeNull();
    expect(fieldAction("ArrowRight", "drive", false)).toBeNull();
  });

  it("leaves every key with a modifier to the field", () => {
    expect(fieldAction("ArrowDown", "enter", true)).toBeNull();
    expect(fieldAction("Enter", "drive", true)).toBeNull();
  });
});

describe("drivenSelection", () => {
  it("keeps the highlighted row while it is listed, else takes the first", () => {
    expect(drivenSelection("b", ["a", "b"])).toBe("b");
    expect(drivenSelection("gone", ["a", "b"])).toBe("a");
    expect(drivenSelection(null, ["a"])).toBe("a");
    expect(drivenSelection("a", [])).toBeNull();
  });
});

describe("list scroll", () => {
  it("is near the end within the margin", () => {
    expect(isNearEnd(0, 300, 1000)).toBe(false);
    expect(isNearEnd(1000 - 300 - NEAR_END_PX, 300, 1000)).toBe(true);
    expect(isNearEnd(0, 300, 300)).toBe(true);
  });

  it("is at the bottom with a little slack", () => {
    expect(isAtBottom(700, 300, 1000)).toBe(true);
    expect(isAtBottom(697.5, 300, 1000)).toBe(true);
    expect(isAtBottom(600, 300, 1000)).toBe(false);
  });
});
