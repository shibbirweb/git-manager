import { describe, expect, it } from "vitest";
import {
  clipIdsOf,
  compareTabPath,
  compareTabsInFolder,
  compareTabTitle,
  isCompareTab,
  parseCompareTabPath,
  sideLabels,
} from "./compareTabs";

describe("compare tabs", () => {
  it("round-trips two files and a clipboard side", () => {
    const files = { left: { kind: "file", filePath: "/w/a|b.ts" }, right: { kind: "file", filePath: "/w/c d.ts" } } as const;
    const tabPath = compareTabPath(files);
    expect(tabPath.startsWith("/")).toBe(false);
    expect(parseCompareTabPath(tabPath)).toEqual(files);
    const clip = { left: { kind: "clipboard", clipId: 3 }, right: { kind: "file", filePath: "/w/a.ts" } } as const;
    expect(parseCompareTabPath(compareTabPath(clip))).toEqual(clip);
    expect(clipIdsOf(compareTabPath(clip))).toEqual([3]);
    expect(clipIdsOf("/w/a.ts")).toEqual([]);
  });

  it("refuses other tab paths and broken ones", () => {
    expect(isCompareTab("/w/a.ts")).toBe(false);
    expect(isCompareTab("compare-files:f%2Fa")).toBe(false);
    expect(isCompareTab("compare-files:frelative|f%2Fb")).toBe(false);
    expect(isCompareTab("compare-files:cx|f%2Fb")).toBe(false);
    expect(isCompareTab("compare-files:f%E0%A4%A|f%2Fb")).toBe(false);
    expect(isCompareTab("compare-files:f%2Fa|f%2Fb")).toBe(true);
  });

  it("names the sides, with folders when the names are the same", () => {
    expect(sideLabels({ left: { kind: "file", filePath: "/w/a.ts" }, right: { kind: "clipboard", clipId: 1 } })).toEqual(["a.ts", "Clipboard"]);
    expect(sideLabels({ left: { kind: "file", filePath: "/w/x/a.ts" }, right: { kind: "file", filePath: "/w/y/a.ts" } })).toEqual([
      "a.ts (x)",
      "a.ts (y)",
    ]);
    expect(compareTabTitle({ left: { kind: "file", filePath: "/w/a.ts" }, right: { kind: "file", filePath: "/w/b.ts" } })).toEqual({
      name: "a.ts vs b.ts",
      title: "/w/a.ts compared with /w/b.ts",
    });
  });

  it("closes with the folder of either file", () => {
    const inside = compareTabPath({ left: { kind: "clipboard", clipId: 1 }, right: { kind: "file", filePath: "/w/one/a.ts" } });
    const outside = compareTabPath({ left: { kind: "file", filePath: "/w/two/a.ts" }, right: { kind: "file", filePath: "/w/two/b.ts" } });
    expect(compareTabsInFolder([inside, outside, "/w/one/a.ts"], "/w/one")).toEqual([inside]);
  });
});
