// Auto save: off, a pause after the last edit, or when the
// editor loses focus (another tab, another part of the window, another app). FileView.svelte
// runs the timers and listeners; this decides whether a save may happen. Pure.

import type { AutoSaveMode } from "$lib/stores/settingsData";

/** What asks for the save: the delay after an edit ran out, or the focus left the editor. */
export type AutoSaveTrigger = "delay" | "focus";

export interface AutoSaveCheck {
  mode: AutoSaveMode;
  trigger: AutoSaveTrigger;
  /** The editor holds edits that are not on disk. */
  dirty: boolean;
  /** A text file in an editor that can write it (not binary, too large, missing or still loading). */
  editable: boolean;
  /** A save is running now. */
  saving: boolean;
  /**
   * Git lists the file as conflicted. Its merge is resolved on purpose (the merge tool, Mark
   * as Resolved or Cmd+S), so half-edited conflict markers are never written behind the user's back.
   */
  conflicted: boolean;
  /** The merge tool has the file open; a write from here would change the file under it. */
  inMergeTool: boolean;
}

export function shouldAutoSave(check: AutoSaveCheck): boolean {
  const wanted =
    (check.mode === "afterDelay" && check.trigger === "delay") || (check.mode === "onFocusChange" && check.trigger === "focus");
  return wanted && check.dirty && check.editable && !check.saving && !check.conflicted && !check.inMergeTool;
}

/** Shortest and longest pause before an auto save, in milliseconds. */
export const AUTO_SAVE_DELAY_RANGE = [100, 60_000] as const;
export const DEFAULT_AUTO_SAVE_DELAY = 1000;
