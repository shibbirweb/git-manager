// The Changes tab, opened from the status bar's changes count: every uncommitted file of
// one repository compared with HEAD, so staged and unstaged edits show together.

import type { ChangeKind, FileStatus } from "$lib/types";

export interface ChangesTabFile {
  path: string;
  /** The old name of a renamed file, read from HEAD. */
  origPath: string | null;
  /** How the file differs from HEAD; null while it is in conflict. */
  kind: ChangeKind | null;
  submodule: boolean;
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
    };
  });
  return [...listed.filter((file) => file.kind === null), ...listed.filter((file) => file.kind !== null)];
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
