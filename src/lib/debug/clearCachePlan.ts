// Clear Cache (the button beside Memory in the status bar): whether the window's page may restart
// now or must wait. Pure, so the rules are tested; clearCache.ts acts on it. Terminals do not
// stop it: they keep running across the restart (terminal_link.rs).

export interface ClearCacheState {
  /** Open files with unsaved edits; a restart would lose them. */
  dirtyFiles: number;
  /** The git operation running now, if any. */
  busy: string | null;
  /** The merge tool is open on a conflict. */
  mergeOpen: boolean;
}

export type ClearCachePlan = { kind: "blocked"; message: string } | { kind: "go" };

function plural(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

export function clearCachePlan(state: ClearCacheState): ClearCachePlan {
  if (state.dirtyFiles > 0) {
    return { kind: "blocked", message: `Save or close the ${plural(state.dirtyFiles, "file")} with unsaved changes first.` };
  }
  if (state.busy !== null) {
    return { kind: "blocked", message: `Wait until "${state.busy}" finishes.` };
  }
  if (state.mergeOpen) {
    return { kind: "blocked", message: "Finish or close the merge tool first." };
  }
  return { kind: "go" };
}
