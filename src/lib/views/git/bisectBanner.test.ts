import { describe, expect, it } from "vitest";
import type { BisectState } from "$lib/types";
import { bisectBadges, bisectBannerText } from "./bisectBanner";

const state = (overrides: Partial<BisectState> = {}): BisectState => ({
  start: "main",
  badTerm: "bad",
  goodTerm: "good",
  bad: "b".repeat(40),
  good: ["a".repeat(40)],
  skipped: [],
  current: "c".repeat(40),
  remaining: 9,
  remainingCapped: false,
  steps: 2,
  firstBad: null,
  ...overrides,
});

describe("bisectBannerText", () => {
  it("counts the steps and commits left", () => {
    expect(bisectBannerText(state())).toBe("Bisecting: about 2 steps left (8 commits to test)");
    expect(bisectBannerText(state({ remaining: 2, steps: 0 }))).toBe("Bisecting: about 1 step left (1 commit to test)");
    expect(bisectBannerText(state({ remainingCapped: true }))).toBe("Bisecting: many commits left to test");
  });

  it("asks for the missing marks", () => {
    expect(bisectBannerText(state({ bad: null, good: [] }))).toBe("Bisecting: mark a bad and a good commit");
    expect(bisectBannerText(state({ bad: null }))).toBe("Bisecting: mark a bad commit");
    expect(bisectBannerText(state({ good: [], badTerm: "new", goodTerm: "old" }))).toBe("Bisecting: mark an old commit");
  });

  it("names the first bad commit", () => {
    const firstBad = { id: "b".repeat(40), shortId: "bbbbbbbb", summary: "Break the login" };
    expect(bisectBannerText(state({ firstBad }))).toBe("Found the first bad commit: bbbbbbbb Break the login");
    expect(bisectBannerText(state({ firstBad: { ...firstBad, summary: "" }, badTerm: "new" }))).toBe("Found the first new commit: bbbbbbbb");
  });
});

describe("bisectBadges", () => {
  it("marks good, bad, skipped and the commit under test", () => {
    const badges = bisectBadges(state({ skipped: ["d".repeat(40)] }));
    expect(badges.get("b".repeat(40))).toEqual([{ kind: "bad", label: "bad" }]);
    expect(badges.get("a".repeat(40))).toEqual([{ kind: "good", label: "good" }]);
    expect(badges.get("d".repeat(40))).toEqual([{ kind: "skip", label: "skipped" }]);
    expect(badges.get("c".repeat(40))).toEqual([{ kind: "current", label: "testing" }]);
    expect(bisectBadges(null).size).toBe(0);
  });

  it("shows the result once found", () => {
    const firstBad = { id: "b".repeat(40), shortId: "bbbbbbbb", summary: "" };
    const badges = bisectBadges(state({ firstBad, current: "b".repeat(40) }));
    expect(badges.get("b".repeat(40))).toEqual([{ kind: "bad", label: "first bad" }]);
  });
});
