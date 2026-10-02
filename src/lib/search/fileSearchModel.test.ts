import { describe, expect, it } from "vitest";
import type { FileSearchItem } from "$lib/types";
import { highlight, moveSelection, pathRows, recentFiles, resultRows, splitLocation } from "./fileSearchModel";

function item(root: string, relativePath: string, indices: number[]): FileSearchItem {
  return { path: `${root}/${relativePath}`, root, relativePath, indices, score: 1 };
}

const one = [{ root: "/w", name: "w" }];
const two = [
  { root: "/w", name: "w" },
  { root: "/other", name: "other" },
];

describe("highlight", () => {
  it("splits text into matched and unmatched runs", () => {
    expect(highlight("cart.ts", [4, 5, 6, 7], 4)).toEqual([
      { text: "cart", match: true },
      { text: ".ts", match: false },
    ]);
    expect(highlight("abc", [], 0)).toEqual([{ text: "abc", match: false }]);
    expect(highlight("", [0], 0)).toEqual([]);
  });

  it("counts code points, not UTF-16 units", () => {
    expect(highlight("😀ab", [1], 0)).toEqual([
      { text: "😀", match: false },
      { text: "a", match: true },
      { text: "b", match: false },
    ]);
  });
});

describe("resultRows", () => {
  it("highlights the name and the folder", () => {
    const [row] = resultRows([item("/w", "src/cart.ts", [0, 1, 2, 4, 5, 6, 7])], one);
    expect(row.path).toBe("/w/src/cart.ts");
    expect(row.name).toBe("cart.ts");
    expect(row.nameParts).toEqual([
      { text: "cart", match: true },
      { text: ".ts", match: false },
    ]);
    expect(row.folderParts).toEqual([{ text: "src", match: true }]);
  });

  it("shifts name indices past a non-ASCII folder", () => {
    const [row] = resultRows([item("/w", "dé/café.txt", [3, 4, 5, 6])], one);
    expect(row.nameParts[0]).toEqual({ text: "café", match: true });
  });

  it("leads with the workspace folder name only when there are several", () => {
    expect(resultRows([item("/other", "a/b.ts", [])], two)[0].folderParts).toEqual([
      { text: "other/", match: false },
      { text: "a", match: false },
    ]);
    expect(resultRows([item("/other", "b.ts", [])], two)[0].folderParts).toEqual([{ text: "other", match: false }]);
    expect(resultRows([item("/w", "b.ts", [])], one)[0].folderParts).toEqual([]);
  });
});

describe("recentFiles", () => {
  it("puts the active file first, then history, then open tabs, once each", () => {
    expect(recentFiles("/w/a.ts", ["/w/b.ts", "/w/a.ts", "/w/c.ts"], ["/w/d.ts", "/w/b.ts"])).toEqual([
      "/w/a.ts",
      "/w/b.ts",
      "/w/c.ts",
      "/w/d.ts",
    ]);
  });

  it("leaves out terminal and commit tabs and stops at the limit", () => {
    expect(recentFiles("terminal:1", ["commit:a9f492bf@/w", "/w/a.ts"], [], 5)).toEqual(["/w/a.ts"]);
    expect(recentFiles(null, ["/w/a", "/w/b", "/w/c"], [], 2)).toEqual(["/w/a", "/w/b"]);
  });

  it("makes rows only for files inside a workspace folder", () => {
    const rows = pathRows(["/w/src/a.ts", "/elsewhere/b.ts", "/w"], one);
    expect(rows.map((row) => row.path)).toEqual(["/w/src/a.ts"]);
    expect(rows[0].folderParts).toEqual([{ text: "src", match: false }]);
  });
});

describe("selection", () => {
  it("wraps single steps and clamps page steps", () => {
    expect(moveSelection(0, 5, -1)).toBe(4);
    expect(moveSelection(4, 5, 1)).toBe(0);
    expect(moveSelection(1, 5, 1)).toBe(2);
    expect(moveSelection(1, 5, 10)).toBe(4);
    expect(moveSelection(3, 5, -10)).toBe(0);
    expect(moveSelection(0, 0, 1)).toBe(0);
  });
});

describe("splitLocation", () => {
  it("matches the backend's line and column parsing", () => {
    expect(splitLocation("cart.ts:42")).toEqual({ text: "cart.ts", line: 42, column: null });
    expect(splitLocation("cart.ts:42:7")).toEqual({ text: "cart.ts", line: 42, column: 7 });
    expect(splitLocation(" cart:42: ")).toEqual({ text: "cart", line: 42, column: null });
    expect(splitLocation("cart:")).toEqual({ text: "cart", line: null, column: null });
    expect(splitLocation(":12")).toEqual({ text: "", line: 12, column: null });
    expect(splitLocation("a:b")).toEqual({ text: "a:b", line: null, column: null });
  });
});
