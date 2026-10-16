// The Shelf's pure parts: the default name of shelved changes, which changed files can be
// shelved, labels, and the selection of shelved files. Tested without the stores.

import type { FileStatus, ShelfEntry, ShelvedFile } from "$lib/types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "2026-10-01 14:03", in local time. */
export function formatShelfDate(createdAt: number): string {
  const date = new Date(createdAt);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The default name: "Changes from main 2026-10-01 14:03". */
export function defaultShelfName(branchName: string | null, now: Date): string {
  const when = formatShelfDate(now.getTime());
  return branchName ? `Changes from ${branchName} ${when}` : `Changes from ${when}`;
}

/** Changed files that can be shelved: conflicts must be resolved first, nested repositories and submodules are not changes of this one. */
export function shelveCandidates(files: FileStatus[]): FileStatus[] {
  return (files ?? []).filter((file) => !file.conflicted && !file.path.endsWith("/") && !file.submodule);
}

/** "old.txt -> new.txt" for a rename or copy, else the path. */
export function shelvedFileLabel(file: ShelvedFile): string {
  return file.oldPath && file.oldPath !== file.path ? `${file.oldPath} -> ${file.path}` : file.path;
}

export function fileCountLabel(count: number): string {
  return count === 1 ? "1 file" : `${count} files`;
}

/** A row of the Shelf's tree: a change list, or one of its files while the list is open. */
export type ShelfRow =
  { kind: "entry"; id: string; entry: ShelfEntry } | { kind: "file"; id: string; entry: ShelfEntry; file: ShelvedFile };

export function entryRowId(shelfId: string): string {
  return `entry\n${shelfId}`;
}

export function fileRowId(shelfId: string, filePath: string): string {
  return `file\n${shelfId}\n${filePath}`;
}

/** Every change list, each followed by its files unless it is folded. */
export function shelfRows(entries: ShelfEntry[], collapsed: ReadonlySet<string>): ShelfRow[] {
  return entries.flatMap((entry): ShelfRow[] => [
    { kind: "entry", id: entryRowId(entry.id), entry },
    ...(collapsed.has(entry.id)
      ? []
      : entry.files.map((file): ShelfRow => ({ kind: "file", id: fileRowId(entry.id, file.path), entry, file }))),
  ]);
}

/** The selected files of one change list (Unshelve Selected Files works on one list at a time). */
export function selectedPaths(selection: readonly string[], entry: ShelfEntry): string[] {
  const chosen = new Set(selection);
  return entry.files.filter((file) => chosen.has(fileRowId(entry.id, file.path))).map((file) => file.path);
}
