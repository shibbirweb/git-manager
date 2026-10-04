import { describe, expect, it } from "vitest";
import { diffLines, type LineHunk } from "./lineDiff";

function apply(oldLines: string[], newLines: string[], hunks: LineHunk[]): string[] {
  const out: string[] = [];
  let position = 0;
  for (const hunk of hunks) {
    out.push(...oldLines.slice(position, hunk.oldStart), ...newLines.slice(hunk.newStart, hunk.newEnd));
    position = hunk.oldEnd;
  }
  out.push(...oldLines.slice(position));
  return out;
}

describe("diffLines", () => {
  it("returns nothing for equal texts", () => {
    expect(diffLines(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("finds a single modified line", () => {
    expect(diffLines(["a", "b", "c"], ["a", "B", "c"])).toEqual([{ oldStart: 1, oldEnd: 2, newStart: 1, newEnd: 2 }]);
  });

  it("finds pure insertions and deletions", () => {
    expect(diffLines(["a", "c"], ["a", "b", "c"])).toEqual([{ oldStart: 1, oldEnd: 1, newStart: 1, newEnd: 2 }]);
    expect(diffLines(["a", "b", "c"], ["a", "c"])).toEqual([{ oldStart: 1, oldEnd: 2, newStart: 1, newEnd: 1 }]);
  });

  it("separates changes far apart", () => {
    const base = Array.from({ length: 50 }, (_, index) => `line ${index}`);
    const edited = [...base];
    edited[3] = "changed";
    edited.splice(40, 0, "inserted");
    expect(diffLines(base, edited)).toHaveLength(2);
  });

  it("always reproduces the new text", () => {
    let seed = 11;
    const random = (bound: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };
    for (let round = 0; round < 300; round++) {
      const oldLines = Array.from({ length: random(30) }, () => `v${random(6)}`);
      const newLines = Array.from({ length: random(30) }, () => `v${random(6)}`);
      expect(apply(oldLines, newLines, diffLines(oldLines, newLines))).toEqual(newLines);
    }
  });

  it("recovers long edit paths in large texts", () => {
    const base = Array.from({ length: 5000 }, (_, index) => `line ${index}`);
    const edited = base.slice();
    for (let index = 0; index < 400; index++) {
      edited[(index * 37) % base.length] = `changed ${index}`;
    }
    edited.splice(100, 0, "inserted");
    const hunks = diffLines(base, edited);
    expect(apply(base, edited, hunks)).toEqual(edited);
    expect(hunks.length).toBeGreaterThan(300);
  });
});
