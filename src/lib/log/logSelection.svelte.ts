// The commit selected in the Log, for Git menu items that act on it (Create Patch from Commit).

class LogSelectionStore {
  /** Repository and commit selected in the Log, or null when nothing is. */
  current = $state<{ repoRoot: string; commitId: string; shortId: string; summary: string } | null>(null);
}

export const logSelection = new LogSelectionStore();
