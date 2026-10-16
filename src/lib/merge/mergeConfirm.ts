// What the merge tool asks before it saves, closes or reloads, and the status line's words.
import { dialogs } from "$lib/ui/dialog.svelte";
import { hasConflictMarkers } from "./model";

export interface OpenCounts {
  changes: number;
  conflicts: number;
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** "All changes processed", "3 changes left" or "3 changes left, 1 conflict". */
export function statusText(counts: OpenCounts): string {
  if (counts.changes === 0) {
    return "All changes processed";
  }
  const changes = `${plural(counts.changes, "change")} left`;
  return counts.conflicts === 0 ? changes : `${changes}, ${plural(counts.conflicts, "conflict")}`;
}

/** The question before saving a result with open changes. */
export function unresolvedMessage(open: OpenCounts): string {
  const changes = `${open.changes} ${open.changes === 1 ? "change is" : "changes are"} still unresolved`;
  const conflicts = open.conflicts > 0 ? `, including ${plural(open.conflicts, "conflict")}` : "";
  return `${changes}${conflicts}. Save the result as it is and mark the file resolved?`;
}

/** Apply: asks about open changes and leftover conflict markers; true to save. */
export async function confirmSave(open: OpenCounts, content: string): Promise<boolean> {
  if (open.changes > 0) {
    const ok = await dialogs.confirm({
      title: "Unresolved Changes",
      message: unresolvedMessage(open),
      confirmLabel: "Save Anyway",
    });
    if (!ok) {
      return false;
    }
  }
  if (hasConflictMarkers(content)) {
    return dialogs.confirm({
      title: "Conflict Markers Found",
      message: "The result still contains conflict markers (<<<<<<<, =======, >>>>>>>). Save anyway?",
      confirmLabel: "Save Anyway",
      danger: true,
    });
  }
  return true;
}

/** Cancel with an edited result. */
export function confirmDiscard(): Promise<boolean> {
  return dialogs.confirm({
    title: "Discard Changes",
    message: "Close the merge window and discard your changes to the result?",
    confirmLabel: "Discard",
    danger: true,
  });
}

/** Ignore whitespace with an edited result. */
export function confirmReload(): Promise<boolean> {
  return dialogs.confirm({
    title: "Reload Merge",
    message: "Changing the whitespace mode recomputes the differences and discards your changes.",
    confirmLabel: "Reload",
  });
}
