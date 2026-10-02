import { describe, expect, it } from "vitest";
import { clipRuns, whitespaceRuns } from "./whitespace";

const text = "\tif (a  && b) {   ";

function shown(line: string, mode: Parameters<typeof whitespaceRuns>[1]): string[] {
  return whitespaceRuns(line, mode).map((run) => `${run.from}-${run.to}${run.tab ? "t" : ""}`);
}

describe("whitespaceRuns", () => {
  it("draws nothing with none", () => {
    expect(whitespaceRuns(text, "none")).toEqual([]);
  });

  it("draws every space stretch and each tab with all and selection", () => {
    const all = ["0-1t", "3-4", "6-8", "10-11", "13-14", "15-18"];
    expect(shown(text, "all")).toEqual(all);
    expect(shown(text, "selection")).toEqual(all);
  });

  it("skips single spaces between words with boundary", () => {
    expect(shown(text, "boundary")).toEqual(["0-1t", "6-8", "15-18"]);
    expect(shown(" a b", "boundary")).toEqual(["0-1"]);
    expect(shown("a\tb", "boundary")).toEqual(["1-2t"]);
  });

  it("draws only what ends the line with trailing", () => {
    expect(shown(text, "trailing")).toEqual(["15-18"]);
    expect(shown("  \t ", "trailing")).toEqual(["0-2", "2-3t", "3-4"]);
    expect(shown("code", "trailing")).toEqual([]);
  });
});

describe("clipRuns", () => {
  it("keeps the parts inside selections, in document order", () => {
    const runs = whitespaceRuns("a    b c", "selection");
    expect(clipRuns(runs, 100, [{ from: 102, to: 107 }])).toEqual([
      { from: 102, to: 105, tab: false },
      { from: 106, to: 107, tab: false },
    ]);
    expect(clipRuns(runs, 100, [{ from: 0, to: 50 }])).toEqual([]);
  });
});
