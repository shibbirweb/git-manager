import { describe, expect, it } from "vitest";
import { isRovingKey, nextIndex } from "./roving";

describe("nextIndex", () => {
  it("moves and wraps at both ends", () => {
    expect(nextIndex(0, 3, "ArrowRight")).toBe(1);
    expect(nextIndex(2, 3, "ArrowRight")).toBe(0);
    expect(nextIndex(0, 3, "ArrowLeft")).toBe(2);
    expect(nextIndex(1, 3, "ArrowUp")).toBe(0);
    expect(nextIndex(1, 3, "ArrowDown")).toBe(2);
  });

  it("skips disabled items and goes to the first or last enabled one", () => {
    const disabled = (index: number) => index === 1;
    expect(nextIndex(0, 3, "ArrowRight", disabled)).toBe(2);
    expect(nextIndex(2, 3, "ArrowLeft", disabled)).toBe(0);
    expect(nextIndex(1, 3, "Home", (index) => index === 0)).toBe(1);
    expect(nextIndex(0, 3, "End", (index) => index === 2)).toBe(1);
  });

  it("stays put when nothing else can be chosen, and is -1 without items", () => {
    expect(nextIndex(0, 1, "ArrowRight")).toBe(0);
    expect(nextIndex(0, 3, "ArrowRight", (index) => index !== 0)).toBe(0);
    expect(nextIndex(0, 0, "ArrowRight")).toBe(-1);
  });

  it("knows its keys", () => {
    expect(isRovingKey("ArrowLeft")).toBe(true);
    expect(isRovingKey("Enter")).toBe(false);
  });
});
