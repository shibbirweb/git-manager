import { describe, expect, it } from "vitest";
import { findLine } from "./lineMatch";

const text = ["import a;", "", "function one() {", "  return 1;", "}", "", "function two() {", "  return 2;", "}"].join("\n");

describe("findLine", () => {
  it("keeps the hint when there is no text to look for", () => {
    expect(findLine(text, 3, null)).toBe(3);
  });

  it("keeps the hint when it already reads the text", () => {
    expect(findLine(text, 7, "  return 2;")).toBe(7);
  });

  it("finds the nearest line with the text when lines moved", () => {
    // The line is further down now than in the commit.
    expect(findLine(text, 9, "  return 2;")).toBe(7);
    expect(findLine(text, 0, "  return 1;")).toBe(3);
  });

  it("prefers the earlier line on a tie", () => {
    expect(findLine(text, 5, "}")).toBe(4);
    expect(findLine(text, 7, "}")).toBe(8);
  });

  it("falls back to the clamped hint when nothing matches", () => {
    expect(findLine(text, 4, "missing")).toBe(4);
    expect(findLine(text, 50, "missing")).toBe(8);
    expect(findLine(text, -3, null)).toBe(0);
  });

  it("ignores carriage returns", () => {
    expect(findLine("one\r\ntwo\r\nthree", 0, "three")).toBe(2);
  });
});
