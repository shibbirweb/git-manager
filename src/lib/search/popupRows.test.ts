import { describe, expect, it } from "vitest";
import type { SearchRow } from "./fileSearchModel";
import {
  emptySource,
  firstSelectable,
  keepSelectedKey,
  moveSelectable,
  type PopupResults,
  scrollToShow,
  SECTION_LIMIT,
  shownLabel,
  tabRows,
  visibleRange,
} from "./popupRows";
import type { SymbolRow } from "./symbolSearchModel";
import { KIND_INFO } from "./symbolSearchModel";
import { EMPTY_TEXT } from "./textSearchModel";

function file(path: string): SearchRow {
  return { path, name: path.slice(path.lastIndexOf("/") + 1), nameParts: [], folderParts: [] };
}

function symbol(name: string): SymbolRow {
  return {
    key: `/w/a.ts:1:1:${name}`,
    path: "/w/a.ts",
    line: 1,
    column: 1,
    kind: KIND_INFO.class,
    nameParts: [{ text: name, match: false }],
    containerParts: [],
    location: "a.ts:1",
    title: "a.ts:1",
  };
}

function results(overrides: Partial<PopupResults> = {}): PopupResults {
  return {
    hasQuery: true,
    recent: [],
    files: emptySource(),
    classes: emptySource(),
    members: emptySource(),
    symbols: emptySource(),
    text: EMPTY_TEXT,
    ...overrides,
  };
}

const many = Array.from({ length: 10 }, (_, index) => symbol(`Cart${index}`));

describe("tabRows", () => {
  it("lists sections in the All tab with a few rows each and a more row", () => {
    const rows = tabRows("all", results({ classes: { rows: many, matched: 40 }, files: { rows: [file("/w/cart.ts")], matched: 1 } }));
    // Files come first, then classes.
    expect(rows.slice(0, 2).map((row) => row.kind)).toEqual(["header", "file"]);
    expect(rows[0]).toMatchObject({ label: "Files" });
    expect(rows[2]).toMatchObject({ kind: "header", label: "Classes" });
    expect(rows.slice(3, 3 + SECTION_LIMIT).every((row) => row.kind === "symbol")).toBe(true);
    expect(rows[3 + SECTION_LIMIT]).toMatchObject({ kind: "more", tab: "classes", label: "34 more" });
    // Symbols with nothing found leave no empty section.
    expect(rows.some((row) => row.kind === "header" && row.label === "Symbols")).toBe(false);
  });

  it("shows recent files without a query in All and Files, nothing in the symbol tabs", () => {
    const empty = results({ hasQuery: false, recent: [file("/w/a.ts")] });
    expect(tabRows("all", empty).map((row) => row.kind)).toEqual(["header", "file"]);
    expect(tabRows("files", empty).map((row) => row.key)).toEqual(["h:recent", "r:/w/a.ts"]);
    expect(tabRows("classes", empty)).toEqual([]);
    expect(tabRows("symbols", empty)).toEqual([]);
  });

  it("gives every row a unique key", () => {
    const rows = tabRows("all", results({ classes: { rows: many, matched: 10 }, members: { rows: many, matched: 10 } }));
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });
});

describe("selection", () => {
  const rows = tabRows("all", results({ classes: { rows: many.slice(0, 2), matched: 2 }, files: { rows: [file("/w/x.ts")], matched: 1 } }));
  // [header, file, header, c0, c1]

  it("skips headings and wraps single steps", () => {
    expect(firstSelectable(rows)).toBe(1);
    expect(moveSelectable(rows, 1, 1)).toBe(3);
    expect(moveSelectable(rows, 3, 1)).toBe(4);
    expect(moveSelectable(rows, 4, 1)).toBe(1);
    expect(moveSelectable(rows, 1, -1)).toBe(4);
    expect(moveSelectable(rows, 1, 10)).toBe(4);
    expect(moveSelectable([], 0, 1)).toBe(0);
  });

  it("keeps the selected row by key when rows refresh", () => {
    const next = tabRows("all", results({ classes: { rows: many.slice(1, 3), matched: 2 }, files: { rows: [file("/w/y.ts")], matched: 1 } }));
    // [header, y, header, c1, c2]: c1 moves from 4 to 3, the gone file falls back to the first row.
    expect(keepSelectedKey(rows, 4, next)).toBe(3);
    expect(keepSelectedKey(rows, 1, next)).toBe(1);
    expect(keepSelectedKey([], 0, next)).toBe(1);
  });
});

describe("virtual list", () => {
  it("renders the visible rows plus some overscan", () => {
    expect(visibleRange(0, 260, 26, 1000)).toEqual({ start: 0, end: 17 });
    expect(visibleRange(2600, 260, 26, 1000)).toEqual({ start: 94, end: 117 });
    expect(visibleRange(2600, 260, 26, 20)).toEqual({ start: 20, end: 20 });
    expect(visibleRange(0, 0, 26, 1000).end).toBeGreaterThan(16);
  });

  it("scrolls just enough to show the selected row", () => {
    expect(scrollToShow(1, 500, 260, 26, 1)).toBe(0);
    expect(scrollToShow(5, 0, 260, 26, 1)).toBe(0);
    expect(scrollToShow(20, 0, 260, 26, 1)).toBe(20 * 26 + 26 - 260);
    expect(scrollToShow(3, 200, 260, 26, 1)).toBe(78);
  });
});

describe("shownLabel", () => {
  it("counts each tab's results with the right plural", () => {
    expect(shownLabel({ rows: ["a", "b"], matched: 2 }, "class")).toBe("2 classes");
    expect(shownLabel({ rows: ["a"], matched: 1 }, "class")).toBe("1 class");
    expect(shownLabel({ rows: ["a", "b", "c"], matched: 3 }, "file")).toBe("3 files");
    expect(shownLabel({ rows: ["a", "b"], matched: 2 }, "symbol")).toBe("2 symbols");
    expect(shownLabel({ rows: [], matched: 0 }, "symbol")).toBe("0 symbols");
  });

  it("says how many are shown when the list is cut", () => {
    expect(shownLabel({ rows: ["a", "b"], matched: 50 }, "class")).toBe("Showing the first 2 of 50");
  });
});
