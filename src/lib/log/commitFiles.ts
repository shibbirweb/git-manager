// The changed files list of a commit. A merge shows, only the files that differ from every
// parent (the ones the merge combined or resolved), or its changes against each parent under a heading per parent.
import type { ChangedFile, CommitDetails } from "$lib/types";

/** Files changed on every side of a merge, or every parent's changes. */
export type MergeView = "merged" | "parents";

export type CommitFileRow =
  | { kind: "heading"; key: string; title: string; count: number }
  | { kind: "file"; key: string; file: ChangedFile; parentIndex: number };

export function isMerge(details: CommitDetails): boolean {
  return details.parents.length > 1;
}

/** A file against the first parent keeps its path as the key, so the selection survives switching views. */
export function fileRowKey(parentIndex: number, filePath: string): string {
  return parentIndex === 0 ? filePath : `${parentIndex}\u0000${filePath}`;
}

export function parentFiles(details: CommitDetails, parentIndex: number): ChangedFile[] {
  if (parentIndex === 0) {
    return details.files;
  }
  return details.laterParentFiles[parentIndex - 1] ?? [];
}

/** "Parent" for a commit with one parent, "Parent 2" for a merge's second. */
export function parentLabel(details: CommitDetails | null, parentIndex: number): string {
  return details && isMerge(details) ? `Parent ${parentIndex + 1}` : "Parent";
}

function fileRow(file: ChangedFile, parentIndex: number): CommitFileRow {
  return { kind: "file", key: fileRowKey(parentIndex, file.path), file, parentIndex };
}

export function commitFileRows(details: CommitDetails, view: MergeView): CommitFileRow[] {
  if (!isMerge(details)) {
    return details.files.map((file) => fileRow(file, 0));
  }
  if (view === "merged") {
    return (details.mergedFiles ?? []).map((file) => fileRow(file, 0));
  }
  return details.parents.flatMap((parentId, parentIndex) => {
    const files = parentFiles(details, parentIndex);
    const heading: CommitFileRow = {
      kind: "heading",
      key: `parent\u0000${parentIndex}`,
      title: `Changes to parent ${parentIndex + 1}: ${parentId.slice(0, 8)}`,
      count: files.length,
    };
    return [heading, ...files.map((file) => fileRow(file, parentIndex))];
  });
}

export function fileRowAt(
  rows: readonly CommitFileRow[],
  key: string | null,
): Extract<CommitFileRow, { kind: "file" }> | null {
  const row = rows.find((candidate) => candidate.key === key);
  return row?.kind === "file" ? row : null;
}

/**
 * The row to select: the first one for `preferredPath` (a file's new or old name), else the current one while it is
 * still listed, else the first file.
 */
export function pickFileRow(
  rows: readonly CommitFileRow[],
  currentKey: string | null,
  preferredPath: string | null,
): string | null {
  const files = rows.filter((row) => row.kind === "file");
  const preferred =
    preferredPath === null
      ? undefined
      : files.find((row) => row.file.path === preferredPath || row.file.origPath === preferredPath);
  if (preferred) {
    return preferred.key;
  }
  if (files.some((row) => row.key === currentKey)) {
    return currentKey;
  }
  return files[0]?.key ?? null;
}

/** The caption above the list. */
export function filesCaption(details: CommitDetails, view: MergeView): string {
  if (isMerge(details) && view === "merged") {
    return details.parents.length > 2 ? "Changed on every side" : "Changed on both sides";
  }
  if (isMerge(details)) {
    return "Changes to parents";
  }
  return details.files.length === 1 ? "1 changed file" : `${details.files.length} changed files`;
}
