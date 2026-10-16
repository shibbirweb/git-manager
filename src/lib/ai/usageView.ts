// How the status bar shows the AI agents' usage, like Orca: "78% 5h · 94% wk", a bar for the fuller window, and a
// warning color from 80%. Pure, so it is tested directly.

import type { ProviderUsage, UsageWindow } from "$lib/types";

export type UsageLevel = "ok" | "warn" | "full";

/** 80% warns (Orca's warning point), 95% reads as full. */
export function usageLevel(usedPercent: number): UsageLevel {
  return usedPercent >= 95 ? "full" : usedPercent >= 80 ? "warn" : "ok";
}

/** "5h" for a 5-hour window, "wk" for a week, else hours or days. */
export function windowShortName(windowMinutes: number): string {
  if (windowMinutes === 10_080) {
    return "wk";
  }
  if (windowMinutes % 1440 === 0) {
    return `${windowMinutes / 1440}d`;
  }
  return windowMinutes % 60 === 0 ? `${windowMinutes / 60}h` : `${windowMinutes}m`;
}

export function windowLongName(windowMinutes: number): string {
  if (windowMinutes === 10_080) {
    return "Weekly";
  }
  return windowMinutes % 60 === 0 && windowMinutes < 1440
    ? `${windowMinutes / 60}-hour`
    : `${windowShortName(windowMinutes)}`;
}

function rounded(usedPercent: number): number {
  return Math.round(Math.min(100, Math.max(0, usedPercent)));
}

/** Every window of a provider with its short and long names: the session, the week, then single models' weeks. */
export function namedWindows(usage: ProviderUsage): { short: string; long: string; window: UsageWindow }[] {
  const plain = [usage.session, usage.weekly]
    .filter((window): window is UsageWindow => window !== null)
    .map((window) => ({
      short: windowShortName(window.windowMinutes),
      long: windowLongName(window.windowMinutes),
      window,
    }));
  const models = (usage.modelWeekly ?? []).map(({ model, window }) => ({
    short: model,
    long: `${model} weekly`,
    window,
  }));
  return [...plain, ...models];
}

/**
 * The status bar text: each window's use and the time left until it resets, "78% 2h 15m · 94% 2d 4h · 12% Fable 2d
 * 4h" (a single model's window keeps its name). A window without a reset time shows its length ("5h", "wk").
 */
export function usageText(usage: ProviderUsage, now: number): string {
  return namedWindows(usage)
    .map(({ short, window }) => {
      const left = window.resetsAt !== null ? timeLeft(window.resetsAt, now) : null;
      const isModel = short !== windowShortName(window.windowMinutes);
      const label = left === null ? short : isModel ? `${short} ${left}` : left;
      return `${rounded(window.usedPercent)}% ${label}`;
    })
    .join(" · ");
}

/** The fullest window, which decides the bar and its color. */
export function tightestWindow(usage: ProviderUsage): UsageWindow | null {
  const windows = namedWindows(usage).map(({ window }) => window);
  return windows.reduce<UsageWindow | null>(
    (tightest, window) => (!tightest || window.usedPercent > tightest.usedPercent ? window : tightest),
    null,
  );
}

/** The time left until a reset: "45m", "3h 20m", "2d 4h"; "0m" once it is due. */
export function timeLeft(resetsAt: number, now: number): string {
  const minutes = Math.max(0, Math.ceil((resetsAt - now) / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
  }
  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `${days}d` : `${days}d ${hours % 24}h`;
}

/** "in 45m", "in 3h 20m", "in 2d 4h"; "now" once it is due. */
export function resetIn(resetsAt: number, now: number): string {
  return resetsAt - now <= 0 ? "now" : `in ${timeLeft(resetsAt, now)}`;
}

/** One line per window for the tooltip: "5-hour: 78% used, resets in 3h 20m". */
export function windowLines(usage: ProviderUsage, now: number): string[] {
  return namedWindows(usage).map(({ long, window }) => {
    const reset = window.resetsAt !== null ? `, resets ${resetIn(window.resetsAt, now)}` : "";
    return `${long}: ${rounded(window.usedPercent)}% used${reset}`;
  });
}

/** "Claude Code (max)": the agent and, when known, its plan. */
export function providerTitle(label: string, usage: ProviderUsage): string {
  return usage.plan ? `${label} (${usage.plan})` : label;
}
