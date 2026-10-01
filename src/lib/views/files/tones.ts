import type { ChangeKind, FileStatus } from "$lib/types";

export type FileTone = "conflict" | "modified" | "added" | "deleted";

export interface FileMark {
  tone: FileTone;
  /** Single status letter, VS Code style: U, A, M, D, R, T or C. */
  letter: string;
  /** Tooltip describing the staged and unstaged state. */
  title: string;
}

const rank: Record<FileTone, number> = {
  deleted: 1,
  added: 2,
  modified: 3,
  conflict: 4,
};

const kindLetters: Record<ChangeKind, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  typechange: "T",
  untracked: "U",
};

const kindWords: Record<ChangeKind, string> = {
  added: "added",
  modified: "modified",
  deleted: "deleted",
  renamed: "renamed",
  typechange: "type changed",
  untracked: "untracked",
};

function toneOf(file: FileStatus): FileTone {
  if (file.conflicted) {
    return "conflict";
  }
  if (file.unstaged === "deleted" || (file.staged === "deleted" && file.unstaged === null)) {
    return "deleted";
  }
  if (file.unstaged === "untracked" || (file.staged === "added" && file.unstaged === null)) {
    return "added";
  }
  return "modified";
}

/** The work tree state wins over the index, as it is what the file looks like now. */
function letterOf(file: FileStatus): string {
  if (file.conflicted) {
    return "C";
  }
  if (file.unstaged === "untracked" || file.unstaged === "deleted") {
    return kindLetters[file.unstaged];
  }
  if (file.staged) {
    return kindLetters[file.staged];
  }
  return file.unstaged ? kindLetters[file.unstaged] : "M";
}

function titleOf(file: FileStatus): string {
  if (file.conflicted) {
    return "Conflicted";
  }
  const parts: string[] = [];
  if (file.staged) {
    parts.push(`${kindWords[file.staged]} (staged)`);
  }
  if (file.unstaged) {
    parts.push(file.unstaged === "untracked" ? "untracked" : `${kindWords[file.unstaged]} (not staged)`);
  }
  if (file.origPath) {
    parts.push(`from ${file.origPath}`);
  }
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Status mark for every changed file. */
export function marksByPath(files: FileStatus[]): Map<string, FileMark> {
  const marks = new Map<string, FileMark>();
  for (const file of files) {
    marks.set(file.path, { tone: toneOf(file), letter: letterOf(file), title: titleOf(file) });
  }
  return marks;
}

/**
 * Git status tone for every changed file and, with the strongest tone of
 * their contents, every folder above it.
 */
export function tonesByPath(files: FileStatus[]): Map<string, FileTone> {
  const tones = new Map<string, FileTone>();
  const raise = (path: string, tone: FileTone) => {
    const current = tones.get(path);
    if (!current || rank[tone] > rank[current]) {
      tones.set(path, tone);
    }
  };
  for (const file of files) {
    const tone = toneOf(file);
    raise(file.path, tone);
    let slash = file.path.lastIndexOf("/");
    while (slash > 0) {
      raise(file.path.slice(0, slash), tone);
      slash = file.path.lastIndexOf("/", slash - 1);
    }
  }
  return tones;
}

/** Files deleted from the work tree, grouped by parent folder ("" is the root). */
export function deletedByFolder(files: FileStatus[]): Map<string, string[]> {
  const folders = new Map<string, string[]>();
  for (const file of files) {
    const deleted = file.unstaged === "deleted" || (file.staged === "deleted" && file.unstaged === null);
    if (!deleted || file.conflicted) {
      continue;
    }
    const slash = file.path.lastIndexOf("/");
    const folder = slash < 0 ? "" : file.path.slice(0, slash);
    const list = folders.get(folder) ?? [];
    list.push(file.path);
    folders.set(folder, list);
  }
  return folders;
}
