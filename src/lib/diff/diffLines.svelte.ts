// The diff on screen that can stage, unstage or discard its selected lines (the Changes
// diff), so the Git menu, the Command Palette and the menu keys reach it. DiffView attaches
// itself while it shows such a diff.

import type { LineAction } from "$lib/types";

export type LineMode = "unstaged" | "staged";

export interface LineTarget {
  /** "unstaged": Stage and Discard; "staged": Unstage. */
  mode: LineMode;
  run: (action: LineAction) => void;
}

/** The actions a diff of `mode` offers. */
export function lineActionsFor(mode: LineMode): LineAction[] {
  return mode === "unstaged" ? ["stage", "discard"] : ["unstage"];
}

class DiffLines {
  target = $state.raw<LineTarget | null>(null);

  /** Returns the detach function. */
  attach(target: LineTarget): () => void {
    this.target = target;
    return () => {
      if (this.target === target) {
        this.target = null;
      }
    };
  }

  /** Runs `action` in the diff on screen; false when no diff there offers it. */
  run(action: LineAction): boolean {
    const target = this.target;
    if (!target || !lineActionsFor(target.mode).includes(action)) {
      return false;
    }
    target.run(action);
    return true;
  }
}

export const diffLines = new DiffLines();
