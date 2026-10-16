// Show Reflog: the labels and colors of the entries.

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

export type ReflogTone = "success" | "danger" | "accent" | "warning" | "dim";

const TONES: Partial<Record<ReflogAction, ReflogTone>> = {
  commit: "success",
  initialCommit: "success",
  amend: "success",
  reset: "danger",
  rebase: "danger",
  checkout: "accent",
  merge: "warning",
  pull: "warning",
  cherryPick: "warning",
  revert: "warning",
};

/** New commits green, history rewrites red, moves blue, combined history amber; the rest dim. */
export function reflogActionTone(action: ReflogAction): ReflogTone {
  return TONES[action] ?? "dim";
}
