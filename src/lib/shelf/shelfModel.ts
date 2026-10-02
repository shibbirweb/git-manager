// The Shelf's pure parts: the default name of shelved changes, which changed files can be
// shelved, labels, and the selection of shelved files. Tested without the stores.

import type { FileStatus, ShelfEntry, ShelvedChange, ShelvedFile } from "$lib/types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "2026-10-01 14:03", in local time. */
export function formatShelfDate(createdAt: number): string {
  const date = new Date(createdAt);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** JetBrains' default: "Changes from main 2026-10-01 14:03". */
export function defaultShelfName(branchName: string | null, now: Date): string {
  const when = formatShelfDate(now.getTime());
  return branchName ? `Changes from ${branchName} ${when}` : `Changes from ${when}`;
}

/** Changed files that can be shelved: conflicts must be resolved first, nested repositories and submodules are not changes of this one. */
export function shelveCandidates(files: FileStatus[]): FileStatus[] {
  return (files ?? []).filter((file) => !file.conflicted && !file.path.endsWith("/") && !file.submodule);
}

export function statusLetter(file: FileStatus): string {
  if (file.unstaged === "untracked" && !file.staged) {
    return "U";
  }
  switch (file.staged ?? file.unstaged) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "typechange":
      return "T";
    default:
      return "M";
  }
}

const CHANGE_LETTERS: Record<ShelvedChange, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  typechange: "T",
};

export function changeLetter(change: ShelvedChange): string {
  return CHANGE_LETTERS[change] ?? "M";
}

/** "old.txt -> new.txt" for a rename or copy, else the path. */
export function shelvedFileLabel(file: ShelvedFile): string {
  return file.oldPath && file.oldPath !== file.path ? `${file.oldPath} -> ${file.path}` : file.path;
}

export function fileCountLabel(count: number): string {
  return count === 1 ? "1 file" : `${count} files`;
}

/** A selected file of a change list. */
export interface ShelfFileKey {
  shelfId: string;
  filePath: string;
}

export function fileKey(key: ShelfFileKey): string {
  return `${key.shelfId}\n${key.filePath}`;
}

/**
 * Click selects one file; Cmd/Ctrl+click adds or removes it, within the same change list
 * (Unshelve Selected Files applies to one list at a time).
 */
export function clickSelection(current: ShelfFileKey[], clicked: ShelfFileKey, toggle: boolean): ShelfFileKey[] {
  if (!toggle) {
    return [clicked];
  }
  const sameList = current.filter((key) => key.shelfId === clicked.shelfId);
  const present = sameList.some((key) => key.filePath === clicked.filePath);
  return present ? sameList.filter((key) => key.filePath !== clicked.filePath) : [...sameList, clicked];
}

/** The selected files that still exist on the shelf. */
export function validSelection(selection: ShelfFileKey[], entries: ShelfEntry[]): ShelfFileKey[] {
  return selection.filter((key) =>
    entries.some((entry) => entry.id === key.shelfId && entry.files.some((file) => file.path === key.filePath)),
  );
}
