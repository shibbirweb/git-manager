import type { ChangeKind, DiffArea, FileStatus } from "$lib/types";
import type { IconName } from "$lib/ui/icons";

export type GroupId = "conflicts" | "staged" | "unstaged";

export interface FileSelection {
  repoRoot: string;
  path: string;
  area: DiffArea;
}

export interface RowAction {
  icon: IconName;
  title: string;
  run: () => void;
  danger?: boolean;
}

const letters: Record<ChangeKind, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  typechange: "T",
  untracked: "U",
};

const titles: Record<ChangeKind, string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
  typechange: "Type changed",
  untracked: "Untracked",
};

export function statusLetter(kind: ChangeKind | null): string {
  return kind ? letters[kind] : "C";
}

export function statusTitle(kind: ChangeKind | null): string {
  return kind ? titles[kind] : "Conflicted";
}

export function kindIn(file: FileStatus, area: DiffArea): ChangeKind | null {
  return area === "staged" ? file.staged : file.unstaged;
}

export function splitPath(filePath: string): { name: string; directory: string } {
  const slash = filePath.lastIndexOf("/");
  if (slash < 0) {
    return { name: filePath, directory: "" };
  }
  return { name: filePath.slice(slash + 1), directory: filePath.slice(0, slash) };
}

/** DOM id of a staged or unstaged row, for `aria-activedescendant` on the list. */
export function rowElementId(selection: FileSelection): string {
  // Encoded so paths with spaces still make one valid id, with no collisions.
  return `change-row-${selection.area}-${encodeURIComponent(`${selection.repoRoot}\0${selection.path}`)}`;
}

export function sameSelection(left: FileSelection | null, right: FileSelection | null): boolean {
  return (
    left !== null &&
    right !== null &&
    left.repoRoot === right.repoRoot &&
    left.path === right.path &&
    left.area === right.area
  );
}

/** Paths to unstage, including the old path of a staged rename. */
export function unstagePaths(files: FileStatus[]): string[] {
  const paths = new Set<string>();
  for (const file of files) {
    paths.add(file.path);
    if (file.origPath) {
      paths.add(file.origPath);
    }
  }
  return [...paths];
}

export function discardPaths(files: FileStatus[]): { trackedPaths: string[]; untrackedPaths: string[] } {
  const trackedPaths: string[] = [];
  const untrackedPaths: string[] = [];
  for (const file of files) {
    if (file.unstaged === "untracked") {
      untrackedPaths.push(file.path);
    } else {
      trackedPaths.push(file.path);
    }
  }
  return { trackedPaths, untrackedPaths };
}
