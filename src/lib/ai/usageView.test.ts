import { describe, expect, it } from "vitest";
import type { ProviderUsage } from "$lib/types";
import { providerTitle, resetIn, tightestWindow, usageLevel, usageText, windowLines, windowShortName } from "./usageView";

const NOW = 1_791_700_000_000;

function usage(extra: Partial<ProviderUsage> = {}): ProviderUsage {
  return {
    provider: "claude",
    status: "ok",
    session: { usedPercent: 77.6, windowMinutes: 300, resetsAt: NOW + 200 * 60_000 },
    weekly: { usedPercent: 94.2, windowMinutes: 10_080, resetsAt: NOW + 52 * 3_600_000 },
    modelWeekly: [],
    plan: "max",
    message: null,
    ...extra,
  };
}

describe("usageText", () => {
  it("shows each window's use and the time left until it resets", () => {
    expect(usageText(usage(), NOW)).toBe("78% 3h 20m · 94% 2d 4h");
    expect(usageText(usage({ session: null }), NOW)).toBe("94% 2d 4h");
    expect(usageText(usage({ session: null, weekly: null }), NOW)).toBe("");
  });

  it("shows the window's length when it has no reset time, and 0m once it is due", () => {
    const unknown = usage({ session: { usedPercent: 5, windowMinutes: 300, resetsAt: null }, weekly: null });
    expect(usageText(unknown, NOW)).toBe("5% 5h");
    const due = usage({ session: { usedPercent: 5, windowMinutes: 300, resetsAt: NOW - 1 }, weekly: null });
    expect(usageText(due, NOW)).toBe("5% 0m");
  });

  it("adds single models' weekly limits, such as Fable", () => {
    const fable = { model: "Fable", window: { usedPercent: 99.4, windowMinutes: 10_080, resetsAt: NOW + 26 * 3_600_000 } };
    const withFable = usage({ modelWeekly: [fable] });
    expect(usageText(withFable, NOW)).toBe("78% 3h 20m · 94% 2d 4h · 99% Fable 1d 2h");
    expect(tightestWindow(withFable)?.usedPercent).toBe(99.4);
    expect(windowLines(withFable, NOW)[2]).toBe("Fable weekly: 99% used, resets in 1d 2h");
  });

  it("clamps odd numbers", () => {
    expect(usageText(usage({ session: { usedPercent: 140, windowMinutes: 300, resetsAt: null }, weekly: null }), NOW)).toBe("100% 5h");
  });
});

describe("windows", () => {
  it("names window lengths", () => {
    expect([300, 10_080, 1440, 2880, 90].map(windowShortName)).toEqual(["5h", "wk", "1d", "2d", "90m"]);
  });

  it("takes the fuller window for the bar", () => {
    expect(tightestWindow(usage())?.windowMinutes).toBe(10_080);
    expect(tightestWindow(usage({ session: null, weekly: null }))).toBeNull();
  });

  it("warns from 80% and reads as full from 95%", () => {
    expect([0, 79.9, 80, 94.9, 95, 100].map(usageLevel)).toEqual(["ok", "ok", "warn", "warn", "full", "full"]);
  });
});

describe("resets", () => {
  it("counts down in minutes, hours and days", () => {
    expect(resetIn(NOW - 1, NOW)).toBe("now");
    expect(resetIn(NOW + 45 * 60_000, NOW)).toBe("in 45m");
    expect(resetIn(NOW + 120 * 60_000, NOW)).toBe("in 2h");
    expect(resetIn(NOW + 200 * 60_000, NOW)).toBe("in 3h 20m");
    expect(resetIn(NOW + 52 * 3_600_000, NOW)).toBe("in 2d 4h");
  });

  it("writes one line per window", () => {
    expect(windowLines(usage(), NOW)).toEqual(["5-hour: 78% used, resets in 3h 20m", "Weekly: 94% used, resets in 2d 4h"]);
    expect(windowLines(usage({ weekly: { usedPercent: 3, windowMinutes: 10_080, resetsAt: null } }), NOW)[1]).toBe(
      "Weekly: 3% used",
    );
  });

  it("names the plan when known", () => {
    expect(providerTitle("Claude Code", usage())).toBe("Claude Code (max)");
    expect(providerTitle("Codex", usage({ plan: null }))).toBe("Codex");
  });
});
