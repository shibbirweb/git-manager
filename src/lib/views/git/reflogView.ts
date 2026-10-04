// Show Reflog: the labels of the entries and the rows on screen of the virtualized list.

import type { ReflogAction, ReflogEntry } from "$lib/types";

const LABELS: Record<ReflogAction, string> = {
  commit: "commit",
  initialCommit: "first commit",
  amend: "amend",
  merge: "merge",
  checkout: "checkout",
  reset: "reset",
  rebase: "rebase",
  pull: "pull",
  cherryPick: "cherry-pick",
  revert: "revert",
  branch: "branch",
  clone: "clone",
  other: "other",
};

export function reflogActionLabel(action: ReflogAction): string {
  return LABELS[action] ?? "other";
}

/** True when the entry points at a commit (a deleted ref's last entry may not). */
export function hasCommit(entry: ReflogEntry): boolean {
  return !/^0+$/.test(entry.newId);
}

/** The first and last index (exclusive) of the rows to render, with `overscan` rows around the viewport. */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan: number,
): { start: number; end: number } {
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const shown = Math.ceil(Math.max(0, viewportHeight) / rowHeight) + 1;
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + shown + overscan);
  return { start: Math.min(start, end), end };
}
