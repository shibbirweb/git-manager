import { describe, expect, it } from "vitest";
import { bracketCandidates, colorBrackets, isBracket, isOpenBracket } from "./bracketDepth";

const levels = (text: string, startDepth = 0) => colorBrackets(bracketCandidates(text, 0), startDepth).map((bracket) => bracket.level);

describe("bracket depth", () => {
  it("finds the bracket characters of a text with their positions", () => {
    expect(bracketCandidates("a(b[c]){}", 10)).toEqual([
      { from: 11, char: "(" },
      { from: 13, char: "[" },
      { from: 15, char: "]" },
      { from: 16, char: ")" },
      { from: 17, char: "{" },
      { from: 18, char: "}" },
    ]);
    expect(isBracket("<")).toBe(false);
    expect(isOpenBracket("{")).toBe(true);
    expect(isOpenBracket("}")).toBe(false);
  });

  it("gives both brackets of a pair the color of their depth", () => {
    expect(levels("(([]))")).toEqual([0, 1, 2, 2, 1, 0]);
    expect(levels("()()")).toEqual([0, 0, 0, 0]);
  });

  it("repeats the three colors deeper down", () => {
    expect(levels("(((())))")).toEqual([0, 1, 2, 0, 0, 2, 1, 0]);
  });

  it("starts at the depth of the brackets still open above the range", () => {
    expect(levels("())", 1)).toEqual([1, 1, 0]);
  });

  it("marks a closing bracket that nothing opened", () => {
    expect(levels(")(")).toEqual([-1, 0]);
    expect(levels("())")).toEqual([0, 0, -1]);
  });
});
