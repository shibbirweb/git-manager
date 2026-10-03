import { describe, expect, it } from "vitest";
import { NO_TAB_LIMIT, pickTabLimit, SINGLE_TAB, TAB_LIMIT_RANGE, tabsToEvict } from "./tabLimit";

const isFile = (tabPath: string) => tabPath.startsWith("/");

describe("pickTabLimit", () => {
  it("keeps no limit, single tab and numbers in range", () => {
    expect(pickTabLimit(0)).toBe(NO_TAB_LIMIT);
    expect(pickTabLimit(1)).toBe(SINGLE_TAB);
    expect(pickTabLimit(8)).toBe(8);
    expect(pickTabLimit(7.6)).toBe(8);
    expect(pickTabLimit(1000)).toBe(TAB_LIMIT_RANGE[1]);
  });

  it("falls back to no limit for anything else", () => {
    expect(pickTabLimit(-3)).toBe(NO_TAB_LIMIT);
    expect(pickTabLimit("5")).toBe(NO_TAB_LIMIT);
    expect(pickTabLimit(Number.POSITIVE_INFINITY)).toBe(NO_TAB_LIMIT);
    expect(pickTabLimit(undefined)).toBe(NO_TAB_LIMIT);
  });
});

describe("tabsToEvict", () => {
  const tab = (path: string, extra: { dirty?: boolean; pinned?: boolean } = {}) => ({ path, dirty: false, ...extra });

  it("closes nothing without a limit or under it", () => {
    const tabs = [tab("/a"), tab("/b")];
    expect(tabsToEvict(tabs, new Map(), NO_TAB_LIMIT, "/b", isFile)).toEqual([]);
    expect(tabsToEvict(tabs, new Map(), 2, "/b", isFile)).toEqual([]);
  });

  it("closes the least recently used file tabs first", () => {
    const tabs = [tab("/a"), tab("/b"), tab("/c"), tab("/d")];
    const used = new Map([
      ["/a", 5],
      ["/b", 1],
      ["/c", 3],
      ["/d", 9],
    ]);
    expect(tabsToEvict(tabs, used, 2, "/d", isFile)).toEqual(["/b", "/c"]);
  });

  it("treats tabs never shown as the oldest, then goes by their place", () => {
    const tabs = [tab("/a"), tab("/b"), tab("/c")];
    expect(tabsToEvict(tabs, new Map([["/a", 2]]), 2, "/c", isFile)).toEqual(["/b"]);
  });

  it("single tab mode replaces the current tab", () => {
    const tabs = [tab("/old"), tab("/new")];
    expect(tabsToEvict(tabs, new Map([["/old", 1]]), SINGLE_TAB, "/new", isFile)).toEqual(["/old"]);
  });

  it("never closes unsaved, pinned or the kept tab, and goes over the limit instead", () => {
    const tabs = [tab("/dirty", { dirty: true }), tab("/pinned", { pinned: true }), tab("/new")];
    expect(tabsToEvict(tabs, new Map(), SINGLE_TAB, "/new", isFile)).toEqual([]);
    const mixed = [tab("/dirty", { dirty: true }), tab("/clean"), tab("/new")];
    expect(tabsToEvict(mixed, new Map(), SINGLE_TAB, "/new", isFile)).toEqual(["/clean"]);
  });

  it("does not count or close pseudo tabs", () => {
    const tabs = [tab("terminal:1"), tab("commit:abcd@/w"), tab("/a"), tab("/b")];
    expect(tabsToEvict(tabs, new Map(), 2, "/b", isFile)).toEqual([]);
    expect(tabsToEvict(tabs, new Map(), SINGLE_TAB, "/b", isFile)).toEqual(["/a"]);
  });
});
