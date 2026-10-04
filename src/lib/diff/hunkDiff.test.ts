import { describe, expect, it } from "vitest";
import type { LineHunk } from "$lib/types";
import { changesFromHunks, hunkDiff, hunkRanges } from "./hunkDiff";

/** Applies character changes to `a`, which must give `b`. */
function apply(a: string, b: string, changes: readonly { fromA: number; toA: number; fromB: number; toB: number }[]): string {
  let out = "";
  let position = 0;
  for (const change of changes) {
    out += a.slice(position, change.fromA) + b.slice(change.fromB, change.toB);
    position = change.toA;
  }
  return out + a.slice(position);
}

/** Line hunks like the backend's, from a longest common subsequence (small inputs only). */
function naiveHunks(a: string[], b: string[]): LineHunk[] {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const hunks: LineHunk[] = [];
  let i = 0;
  let j = 0;
  let open: LineHunk | null = null;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (open) {
        hunks.push(open);
        open = null;
      }
      i++;
      j++;
      continue;
    }
    open ??= [i, i, j, j];
    if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) {
      j++;
    } else {
      i++;
    }
    open[1] = i;
    open[3] = j;
  }
  if (open) {
    hunks.push(open);
  }
  return hunks;
}

describe("hunkRanges", () => {
  it("maps line hunks to character ranges", () => {
    expect(hunkRanges("a\nb\nc", "a\nB\nc", [[1, 2, 1, 2]])).toEqual([[2, 4, 2, 4]]);
  });

  it("handles lines added or removed after the last line", () => {
    expect(hunkRanges("x", "x\ny", [[1, 1, 1, 2]])).toEqual([[1, 1, 1, 3]]);
    expect(hunkRanges("x\ny", "x", [[1, 2, 1, 1]])).toEqual([[1, 3, 1, 1]]);
  });

  it("refuses hunks that do not fit the texts", () => {
    expect(hunkRanges("a\nb", "a\nc", [[0, 5, 0, 1]])).toBeNull();
    // Right lines but for other texts: the unchanged parts differ in length.
    expect(hunkRanges("a\nbbbb\nc", "a\nB\ncc", [[1, 2, 1, 2]])).toBeNull();
  });
});

describe("changesFromHunks", () => {
  it("always rebuilds the new text", () => {
    let seed = 5;
    const random = (bound: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };
    for (let round = 0; round < 300; round++) {
      const a = Array.from({ length: 1 + random(12) }, () => `v${random(5)}`);
      const b = Array.from({ length: 1 + random(12) }, () => `v${random(5)}`);
      const textA = a.join("\n");
      const textB = b.join("\n");
      const changes = changesFromHunks(textA, textB, naiveHunks(a, b));
      expect(changes).not.toBeNull();
      expect(apply(textA, textB, changes!)).toBe(textB);
    }
  });

  it("keeps scattered edits in a large file apart", () => {
    const base = Array.from({ length: 20000 }, (_, index) => `const value${index} = compute(${index});`);
    const edited = base.slice();
    for (let index = 1000; index < 20000; index += 2000) {
      edited[index] = `const changed${index} = 0;`;
    }
    const hunks: LineHunk[] = [];
    for (let index = 1000; index < 20000; index += 2000) {
      hunks.push([index, index + 1, index, index + 1]);
    }
    const a = base.join("\n");
    const b = edited.join("\n");
    const changes = hunkDiff(a, b, hunks)(a, b);
    expect(apply(a, b, changes)).toBe(b);
    // Each change stays on its own line.
    expect(new Set(changes.map((change) => a.slice(0, change.fromA).split("\n").length)).size).toBe(10);
  });

  it("falls back to CodeMirror's diff for other texts", () => {
    const run = hunkDiff("a\nb", "a\nc", [[1, 2, 1, 2]]);
    expect(apply("x\ny", "x\nz", run("x\ny", "x\nz"))).toBe("x\nz");
  });
});
