import { describe, expect, it } from "vitest";
import { optionMove } from "./optionMove";

describe("optionMove", () => {
  it("moves with the arrows and stops at the ends", () => {
    expect(optionMove(0, "ArrowDown", 5)).toBe(1);
    expect(optionMove(4, "ArrowDown", 5)).toBe(4);
    expect(optionMove(0, "ArrowUp", 5)).toBe(0);
    expect(optionMove(3, "ArrowUp", 5)).toBe(2);
  });

  it("starts from the first or last when nothing is selected", () => {
    expect(optionMove(-1, "ArrowDown", 5)).toBe(0);
    expect(optionMove(-1, "ArrowUp", 5)).toBe(4);
  });

  it("jumps with Home, End and the page keys", () => {
    expect(optionMove(2, "Home", 20)).toBe(0);
    expect(optionMove(2, "End", 20)).toBe(19);
    expect(optionMove(2, "PageDown", 20)).toBe(10);
    expect(optionMove(15, "PageDown", 20)).toBe(19);
    expect(optionMove(5, "PageUp", 20)).toBe(0);
  });

  it("ignores other keys and empty lists", () => {
    expect(optionMove(1, "a", 5)).toBeNull();
    expect(optionMove(0, "ArrowDown", 0)).toBeNull();
  });
});
