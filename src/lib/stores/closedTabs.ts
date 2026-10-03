// Reopen Closed Tab (Shift+Cmd+T): a short stack of the tabs closed last, kept in memory
// only. Each entry is a path, its place in the strip and where the caret was, nothing
// heavier, so a long session of opening and closing files costs almost nothing. Pure.

import type { TabPosition } from "./tabSession";

export interface ClosedTab {
  /** Absolute file path, or a commit, history or branches tab path. */
  path: string;
  /** Its index in the tab strip when it closed. */
  index: number;
  preview: boolean;
  pinned: boolean;
  position: TabPosition | null;
  /** The editor group it closed in: 0 the left (or only) one, 1 the right one. */
  side?: number;
}

export const MAX_CLOSED_TABS = 20;

/**
 * `closed` pushed on top of `stack` (the newest last). A path closed again replaces its
 * older entry, so the stack never offers the same tab twice; the oldest go past `limit`.
 */
export function pushClosedTabs(stack: readonly ClosedTab[], closed: readonly ClosedTab[], limit = MAX_CLOSED_TABS): ClosedTab[] {
  if (closed.length === 0) {
    return stack.slice();
  }
  const closing = new Set(closed.map((tab) => tab.path));
  const next = [...stack.filter((tab) => !closing.has(tab.path)), ...closed];
  return next.slice(Math.max(0, next.length - limit));
}

/**
 * The newest entry `canReopen` accepts, and the stack without it. Entries it refuses on the
 * way (open again already, or gone) are dropped too, since they can never be reopened.
 */
export function popClosedTab(
  stack: readonly ClosedTab[],
  canReopen: (tab: ClosedTab) => boolean,
): { tab: ClosedTab | null; stack: ClosedTab[] } {
  const rest = stack.slice();
  while (rest.length > 0) {
    const tab = rest.pop() as ClosedTab;
    if (canReopen(tab)) {
      return { tab, stack: rest };
    }
  }
  return { tab: null, stack: rest };
}

/** The editor of a closed tab reported its last position while going away: the newest entry for `path` takes it. */
export function updateClosedPosition(stack: readonly ClosedTab[], path: string, position: TabPosition): ClosedTab[] {
  for (let index = stack.length - 1; index >= 0; index--) {
    if (stack[index].path === path) {
      const next = stack.slice();
      next[index] = { ...stack[index], position };
      return next;
    }
  }
  return stack as ClosedTab[];
}

export interface ReopenTab {
  path: string;
  preview: boolean;
  dirty: boolean;
  pinned?: boolean;
}

/** The strip with `closed` back at its old index (or the end, when fewer tabs are left), made active. */
export function reopenAt<T extends ReopenTab>(
  tabs: readonly T[],
  closed: ClosedTab,
  make: (tab: ClosedTab) => T,
): { tabs: T[]; active: string } {
  if (tabs.some((tab) => tab.path === closed.path)) {
    return { tabs: tabs.slice(), active: closed.path };
  }
  const next = tabs.slice();
  next.splice(Math.max(0, Math.min(closed.index, next.length)), 0, make(closed));
  return { tabs: next, active: closed.path };
}
