import { describe, expect, it } from "vitest";
import { emptySource } from "./popupRows";
import { searchCapped, searchEmptyText, searchPlaceholder, type SearchState, searchStatus } from "./searchTexts";
import { EMPTY_TEXT } from "./textSearchModel";

function state(extra: Partial<SearchState> = {}): SearchState {
  return {
    tab: "files",
    query: "",
    hasQuery: false,
    files: emptySource(),
    classes: emptySource(),
    symbols: emptySource(),
    text: EMPTY_TEXT,
    textRunning: false,
    replacing: null,
    fileIndex: null,
    symbolIndex: null,
    error: null,
    ...extra,
  };
}

describe("search texts", () => {
  it("says the index is building, then counts what shows", () => {
    expect(searchStatus(state({ fileIndex: { indexed: 1200, done: false, truncated: false } }))).toMatch(/^Indexing/);
    expect(searchStatus(state())).toBe("");
    expect(searchStatus(state({ tab: "text", replacing: "counting" }))).toBe("Counting matches...");
  });

  it("notes a capped index", () => {
    expect(searchCapped(state({ fileIndex: { indexed: 100000, done: true, truncated: true } }))).toMatch(/files/);
    expect(searchCapped(state())).toBeNull();
  });

  it("explains an empty list for each tab", () => {
    expect(searchEmptyText(state())).toBe("No recent files");
    expect(searchEmptyText(state({ tab: "classes" }))).toBe("Type a class, interface or type name");
    expect(searchEmptyText(state({ tab: "text", query: "a" }))).toBe(
      "Type at least 2 characters to search file contents",
    );
    expect(searchEmptyText(state({ hasQuery: true }))).toBe("No files match");
  });

  it("has a placeholder per tab", () => {
    expect(searchPlaceholder("text")).toBe("Search file contents");
  });
});
