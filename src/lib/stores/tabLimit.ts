// Settings > Editor > Tab limit, like VS Code's workbench.editor.limit and JetBrains' tab
// limit: past the limit, opening a file closes the file tab used least recently. Single tab
// mode is a limit of 1, so a new file replaces the one on screen. Tabs with unsaved changes
// and pinned tabs are never closed this way; when only those are left, the strip grows past
// the limit. Only file tabs count: commit, history, branches and terminal tabs are opened on
// purpose and hold state a reopen would lose. Pure.

/** 0 is no limit, 1 is single tab mode, anything else the number of file tabs. */
export const NO_TAB_LIMIT = 0;
export const SINGLE_TAB = 1;
/** A number limit lies in this range; VS Code starts at 10. */
export const TAB_LIMIT_RANGE = [2, 100] as const;
export const DEFAULT_TAB_LIMIT_NUMBER = 10;

/** A limit from settings.json: a whole number in range, or no limit for anything else. */
export function pickTabLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return NO_TAB_LIMIT;
  }
  const whole = Math.round(value);
  if (whole <= NO_TAB_LIMIT) {
    return NO_TAB_LIMIT;
  }
  if (whole === SINGLE_TAB) {
    return SINGLE_TAB;
  }
  return Math.min(TAB_LIMIT_RANGE[1], Math.max(TAB_LIMIT_RANGE[0], whole));
}

export interface LimitedTab {
  path: string;
  dirty: boolean;
  pinned?: boolean;
}

/**
 * The file tabs to close so at most `limit` stay open, least recently used first. `lastUsed`
 * holds a growing stamp per tab path (a tab without one counts as the oldest, then by its
 * place in the strip). `keepPath` (the tab just opened) is never chosen.
 */
export function tabsToEvict(
  tabs: readonly LimitedTab[],
  lastUsed: ReadonlyMap<string, number>,
  limit: number,
  keepPath: string | null,
  isFile: (tabPath: string) => boolean,
): string[] {
  if (limit <= NO_TAB_LIMIT) {
    return [];
  }
  const files = tabs.filter((tab) => isFile(tab.path));
  const excess = files.length - limit;
  if (excess <= 0) {
    return [];
  }
  const order = new Map(tabs.map((tab, index) => [tab.path, index]));
  return files
    .filter((tab) => !tab.dirty && !tab.pinned && tab.path !== keepPath)
    .sort(
      (a, b) =>
        (lastUsed.get(a.path) ?? -1) - (lastUsed.get(b.path) ?? -1) || (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0),
    )
    .slice(0, excess)
    .map((tab) => tab.path);
}
