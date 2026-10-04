import { describe, expect, it } from "vitest";
import { pickUnloadTabMinutes, tabsToSleep, type TabSleepEntry } from "./tabSleep";

const MINUTE = 60_000;

function entry(key: string, shown: boolean, eligible = true): TabSleepEntry {
  return { key, shown, eligible };
}

describe("tabsToSleep", () => {
  it("starts counting when a hidden tab is first seen", () => {
    const lastShown = new Map<string, number>();
    expect(tabsToSleep([entry("a", true), entry("b", false)], lastShown, 0, 15 * MINUTE)).toEqual([]);
    expect(lastShown).toEqual(new Map([["a", 0], ["b", 0]]));
    expect(tabsToSleep([entry("a", true), entry("b", false)], lastShown, 14 * MINUTE, 15 * MINUTE)).toEqual([]);
    expect(tabsToSleep([entry("a", true), entry("b", false)], lastShown, 15 * MINUTE, 15 * MINUTE)).toEqual(["b"]);
  });

  it("never puts the shown tab to sleep, and counts again from its last showing", () => {
    const lastShown = new Map([["a", 0]]);
    expect(tabsToSleep([entry("a", true)], lastShown, 60 * MINUTE, 15 * MINUTE)).toEqual([]);
    expect(tabsToSleep([entry("a", false)], lastShown, 70 * MINUTE, 15 * MINUTE)).toEqual([]);
    expect(tabsToSleep([entry("a", false)], lastShown, 75 * MINUTE, 15 * MINUTE)).toEqual(["a"]);
  });

  it("keeps tabs that cannot sleep: unsaved edits, other tab kinds, already asleep", () => {
    const lastShown = new Map([["dirty", 0], ["commit", 0]]);
    expect(tabsToSleep([entry("dirty", false, false), entry("commit", false, false)], lastShown, 60 * MINUTE, 5 * MINUTE)).toEqual([]);
  });

  it("forgets closed tabs", () => {
    const lastShown = new Map([["gone", 0], ["a", 0]]);
    tabsToSleep([entry("a", true)], lastShown, MINUTE, 5 * MINUTE);
    expect([...lastShown.keys()]).toEqual(["a"]);
  });
});

describe("pickUnloadTabMinutes", () => {
  it("keeps a listed choice, else the fallback", () => {
    expect(pickUnloadTabMinutes(30, 15)).toBe(30);
    expect(pickUnloadTabMinutes(7, 15)).toBe(15);
    expect(pickUnloadTabMinutes("5", 15)).toBe(15);
  });
});
