// The Changes tab, opened from the status bar's changes count: every uncommitted file of
// one repository compared with HEAD, so staged and unstaged edits show together.

import type { ChangeKind, FileStatus } from "$lib/types";
import { isSubmoduleEntry } from "./submodules/submoduleModel";

export interface ChangesTabFile {
  path: string;
  /** The old name of a renamed file, read from HEAD. */
  origPath: string | null;
  /** How the file differs from HEAD; null while it is in conflict. */
  kind: ChangeKind | null;
  submodule: boolean;
  /** The status row, for stage, unstage and discard. */
  status: FileStatus;
}

/** One letter for both areas: what HEAD to the work tree looks like. */
export function changeAgainstHead(file: FileStatus): ChangeKind | null {
  if (file.conflicted) {
    return null;
  }
  if (file.unstaged === "deleted" || file.staged === "deleted") {
    return "deleted";
  }
  if (file.unstaged === "untracked") {
    return "untracked";
  }
  if (file.staged === "added") {
    return "added";
  }
  if (file.staged === "renamed") {
    return "renamed";
  }
  return file.unstaged ?? file.staged ?? "modified";
}

/** The tab's list: conflicts first, then the status order (by path). */
export function changesTabFiles(files: FileStatus[]): ChangesTabFile[] {
  const listed = files.map((file) => {
    const kind = changeAgainstHead(file);
    return {
      path: file.path,
      origPath: kind === "renamed" ? (file.origPath ?? null) : null,
      kind,
      submodule: Boolean(file.submodule),
      status: file,
    };
  });
  return [...listed.filter((file) => file.kind === null), ...listed.filter((file) => file.kind !== null)];
}

export type ChangesTabAction = "resolve" | "unstage" | "discard" | "stage";

/** The hover buttons of a row, in display order, like the Changes sidebar offers them. */
export function fileActions(file: FileStatus): ChangesTabAction[] {
  if (file.conflicted) {
    return ["resolve"];
  }
  const actions: ChangesTabAction[] = [];
  if (file.staged !== null) {
    actions.push("unstage");
  }
  if (file.unstaged !== null) {
    // Discarding does not apply to a submodule: Update (in the sidebar) checks out the recorded commit.
    if (!isSubmoduleEntry(file)) {
      actions.push("discard");
    }
    actions.push("stage");
  }
  return actions;
}

/** How much of a file is in the index: shown next to its name, since the list mixes both areas. */
export function stagedState(file: FileStatus): "staged" | "partly staged" | null {
  if (file.conflicted || file.staged === null) {
    return null;
  }
  return file.unstaged === null ? "staged" : "partly staged";
}

export interface BulkTargets {
  stage: FileStatus[];
  unstage: FileStatus[];
  discard: FileStatus[];
}

/** What Stage All, Unstage All and Discard All act on; conflicts are left to the merge tool. */
export function bulkTargets(files: ChangesTabFile[]): BulkTargets {
  const targets: BulkTargets = {
    stage: [],
    unstage: [],
    discard: [],
  };
  for (const { status } of files) {
    const actions = fileActions(status);
    if (actions.includes("stage")) {
      targets.stage.push(status);
    }
    if (actions.includes("unstage")) {
      targets.unstage.push(status);
    }
    if (actions.includes("discard")) {
      targets.discard.push(status);
    }
  }
  return targets;
}

/** Keeps the selected file while it is still changed, else the first one. */
export function pickSelected(files: ChangesTabFile[], selectedPath: string | null): ChangesTabFile | null {
  return files.find((file) => file.path === selectedPath) ?? files[0] ?? null;
}

/** The next or previous file for Up and Down. */
export function stepSelection(files: ChangesTabFile[], selectedPath: string | null, step: 1 | -1): ChangesTabFile | null {
  if (files.length === 0) {
    return null;
  }
  const index = files.findIndex((file) => file.path === selectedPath);
  return files[Math.max(0, Math.min(files.length - 1, index + step))] ?? null;
}

/** The diff keeps at least this much room when the list is dragged wide. */
export const MIN_CHANGES_DIFF_WIDTH = 240;

/**
 * The file list's width: the saved one, kept between the minimum and what the diff can
 * spare. Before the tab is measured (width 0) the saved width is used as it is.
 */
export function changesListBounds(savedWidth: number, bodyWidth: number, minWidth: number): { width: number; max: number } {
  if (bodyWidth <= 0) {
    return { width: Math.max(minWidth, savedWidth), max: Math.max(minWidth, savedWidth) };
  }
  const max = Math.max(minWidth, Math.round(bodyWidth - MIN_CHANGES_DIFF_WIDTH));
  return { width: Math.round(Math.min(max, Math.max(minWidth, savedWidth))), max };
}
