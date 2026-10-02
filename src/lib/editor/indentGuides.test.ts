import { describe, expect, it } from "vitest";
import { blankLevels, guideLevels, guideRuns, indentColumns, levelsFor } from "./indentGuides";

function levels(text: string, tabSize = 4, unit = 4): number[] {
  const lines = text.split("\n");
  return guideLevels((lineNumber) => lines[lineNumber - 1], lines.length, 1, lines.length, tabSize, unit);
}

describe("indent guides", () => {
  it("measures indentation in columns, tabs to the next stop", () => {
    expect(indentColumns("    a", 4)).toBe(4);
    expect(indentColumns("\ta", 4)).toBe(4);
    expect(indentColumns("  \ta", 4)).toBe(4);
    expect(indentColumns("a", 4)).toBe(0);
    expect(indentColumns("   ", 4)).toBeNull();
    expect(indentColumns("", 4)).toBeNull();
  });

  it("draws one guide per indent level started", () => {
    expect(levelsFor(0, 4)).toBe(0);
    expect(levelsFor(4, 4)).toBe(1);
    expect(levelsFor(6, 4)).toBe(2);
    expect(levelsFor(8, 2)).toBe(4);
  });

  it("carries guides through blank lines inside a block, like VS Code", () => {
    expect(blankLevels(2, 2)).toBe(2);
    expect(blankLevels(0, 1)).toBe(1);
    expect(blankLevels(1, 0)).toBe(1);
    expect(blankLevels(null, 1)).toBe(0);
    expect(blankLevels(1, null)).toBe(0);
  });

  it("computes the levels of a block", () => {
    const code = ["function a() {", "    if (x) {", "        b();", "", "        c();", "    }", "", "}", ""].join("\n");
    expect(levels(code)).toEqual([0, 1, 2, 2, 2, 1, 1, 0, 0]);
  });

  it("looks past the range for blank lines at its edges", () => {
    const lines = ["{", "    a();", "", "", "    b();", "}"];
    expect(guideLevels((lineNumber) => lines[lineNumber - 1], lines.length, 3, 4, 4, 4)).toEqual([1, 1]);
  });

  it("follows a two-space indent", () => {
    expect(levels("a:\n  b:\n    c: 1", 4, 2)).toEqual([0, 1, 2]);
  });
});

describe("guide runs", () => {
  const block = (top: number, levels: number, wrapped = false, height = 10) => ({ top, height, levels, wrapped });

  it("joins touching blocks into one guide per level", () => {
    const runs = guideRuns([block(0, 0), block(10, 1), block(20, 2), block(30, 2), block(40, 1), block(50, 0)], 10);
    expect(runs).toEqual([
      { level: 0, top: 10, bottom: 50 },
      { level: 1, top: 20, bottom: 40 },
    ]);
  });

  it("gives a wrapped line guides on its first row only", () => {
    const runs = guideRuns([block(0, 1), block(10, 1, true, 30), block(40, 1)], 10);
    expect(runs).toEqual([
      { level: 0, top: 0, bottom: 20 },
      { level: 0, top: 40, bottom: 50 },
    ]);
  });

  it("breaks a guide where the blocks do not touch", () => {
    expect(guideRuns([block(0, 1), block(25, 1)], 10)).toHaveLength(2);
  });
});
