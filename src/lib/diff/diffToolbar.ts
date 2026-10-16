// The diff toolbar's change counter, the same for the two-pane and the three-pane diff.

/** "No changes", the summary ("4 changes", "4 changes, 1 conflict") until one is picked, then "2 of 4". */
export function changeCounter(changeCount: number, current: number, summary: string | null = null): string {
  if (changeCount === 0) {
    return "No changes";
  }
  if (current < 0) {
    return summary ?? (changeCount === 1 ? "1 change" : `${changeCount} changes`);
  }
  return `${current + 1} of ${changeCount}`;
}

/** The Three panes button's tooltip in the Changes diffs and for a merge commit's file. */
export const STAGING_PANES_TITLE = "Three panes: HEAD, the index and the work tree";
export const MERGE_PANES_TITLE = "Three panes: both parents and the merge";
