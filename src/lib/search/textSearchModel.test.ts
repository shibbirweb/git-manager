import { describe, expect, it } from "vitest";
import type { TextSearchBatch } from "$lib/types";
import { appendBatch, EMPTY_TEXT, nextSearchId, rangeParts, searchable, textStatus } from "./textSearchModel";

const one = [{ root: "/w", name: "w" }];

function batch(overrides: Partial<TextSearchBatch> = {}): TextSearchBatch {
  return { files: [], done: false, matches: 0, filesMatched: 0, filesSearched: 0, more: false, error: null, ...overrides };
}

const cartFile = {
  path: "/w/src/cart.ts",
  root: "/w",
  relativePath: "src/cart.ts",
  lines: [
    { line: 1, column: 14, text: "export class Cart {", ranges: [[13, 17]] as [number, number][] },
    { line: 4, column: 1, text: "cart = cart", ranges: [[0, 4], [7, 11]] as [number, number][] },
  ],
};

describe("rangeParts", () => {
  it("splits at UTF-16 ranges", () => {
    expect(rangeParts("cart = cart", [[0, 4], [7, 11]])).toEqual([
      { text: "cart", match: true },
      { text: " = ", match: false },
      { text: "cart", match: true },
    ]);
    expect(rangeParts("😀 cart", [[3, 7]])).toEqual([
      { text: "😀 ", match: false },
      { text: "cart", match: true },
    ]);
    expect(rangeParts("abc", [])).toEqual([{ text: "abc", match: false }]);
    // Overlapping or out-of-range ranges never repeat or overflow text.
    expect(rangeParts("abc", [[0, 2], [1, 3], [5, 9]])).toEqual([
      { text: "ab", match: true },
      { text: "c", match: true },
    ]);
  });
});

describe("appendBatch", () => {
  it("adds a heading per file and a row per line", () => {
    const results = appendBatch(EMPTY_TEXT, batch({ files: [cartFile], matches: 2, filesMatched: 1 }), one, true);
    expect(results.rows.map((row) => row.key)).toEqual(["tf:/w/src/cart.ts", "tl:/w/src/cart.ts:1", "tl:/w/src/cart.ts:4"]);
    expect(results.rows[0]).toMatchObject({ kind: "textFile", name: "cart.ts", folder: "src", count: 2 });
    expect(results.rows[1]).toMatchObject({ kind: "textLine", line: 1, column: 14 });
    expect(results.matches).toBe(2);
    expect(results.done).toBe(false);
  });

  it("appends later batches, starts over on a new search and drops repeated files", () => {
    const first = appendBatch(EMPTY_TEXT, batch({ files: [cartFile] }), one, true);
    const other = { ...cartFile, path: "/w/a.ts", relativePath: "a.ts", lines: [cartFile.lines[0]] };
    const second = appendBatch(first, batch({ files: [other, cartFile], done: true }), one, false);
    expect(second.rows.length).toBe(5);
    expect(second.done).toBe(true);
    expect(second.rows[3]).toMatchObject({ kind: "textFile", folder: "" });
    const fresh = appendBatch(second, batch({ done: true }), one, true);
    expect(fresh.rows).toEqual([]);
  });
});

describe("text status", () => {
  it("counts matches and files, says when capped and while searching", () => {
    const results = { ...EMPTY_TEXT, matches: 12, filesMatched: 3 };
    expect(textStatus(results, false)).toBe("12 matches in 3 files");
    expect(textStatus({ ...results, matches: 1, filesMatched: 1 }, false)).toBe("1 match in 1 file");
    expect(textStatus({ ...results, more: true, matches: 2000 }, false)).toBe("Showing the first 2,000 matches in 3 files");
    expect(textStatus(results, true)).toBe("Searching... 12 matches in 3 files");
    expect(textStatus(EMPTY_TEXT, true)).toBe("Searching...");
    expect(textStatus(EMPTY_TEXT, false)).toBe("");
    expect(textStatus({ ...EMPTY_TEXT, error: "Invalid regular expression: x" }, false)).toBe("Invalid regular expression: x");
  });

  it("needs two characters", () => {
    expect(searchable("a")).toBe(false);
    expect(searchable("😀")).toBe(false);
    expect(searchable("ab")).toBe(true);
  });

  it("hands out growing search ids", () => {
    const first = nextSearchId(1000);
    expect(nextSearchId(1000)).toBe(first + 1);
    expect(nextSearchId(5)).toBe(first + 2);
    expect(nextSearchId(2000)).toBe(2_000_000);
  });
});
