import { joinPath } from "$lib/stores/workspacePaths";
import type { ChangeKind, FileStatus } from "$lib/types";

export type FileTone = "conflict" | "modified" | "added" | "deleted";

export interface FileMark {
  tone: FileTone;
  /** Single status letter: U, A, M, D, R, T or C. */
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
  /** False when `path` already has this tone or a stronger one: then so has every folder above it. */
  const raise = (path: string, tone: FileTone) => {
    const current = tones.get(path);
    if (current && rank[current] >= rank[tone]) {
      return false;
    }
    tones.set(path, tone);
    return true;
  };
  for (const file of files) {
    const tone = toneOf(file);
    if (!raise(file.path, tone)) {
      continue;
    }
    let slash = file.path.lastIndexOf("/");
    while (slash > 0 && raise(file.path.slice(0, slash), tone)) {
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

/** Tones, marks and deleted files of one repository, with absolute paths. */
export interface RepoTones {
  tones: Map<string, FileTone>;
  marks: Map<string, FileMark>;
  deleted: Map<string, string[]>;
}

/** What the Files panel looks up per row, over every repository of the workspace. */
export interface WorkspaceTones {
  tone: (path: string) => FileTone | undefined;
  mark: (path: string) => FileMark | undefined;
  deletedIn: (dirPath: string) => string[];
}

/** One cache entry per status object: an unchanged status keeps its object, so it is worked out once. */
const repoCache = new WeakMap<object, { repoRoot: string; result: RepoTones }>();

/** The tones of one repository's status (its repo-relative `files`), cached while that status object lives. */
export function repoTones(status: { files: FileStatus[] }, repoRoot: string): RepoTones {
  const cached = repoCache.get(status);
  if (cached && cached.repoRoot === repoRoot) {
    return cached.result;
  }
  const files: FileStatus[] = [];
  for (const file of status.files) {
    // A nested repository shows up in its parent as an untracked "dir/".
    if (file.path.endsWith("/")) {
      continue;
    }
    files.push({
      ...file,
      path: joinPath(repoRoot, file.path),
      origPath: file.origPath ? joinPath(repoRoot, file.origPath) : null,
    });
  }
  const result = { tones: tonesByPath(files), marks: marksByPath(files), deleted: deletedByFolder(files) };
  repoCache.set(status, { repoRoot, result });
  return result;
}

/**
 * Looks rows up in every repository's tones without merging them: the same answers as the
 * functions above over all files at once (folders take the strongest tone, a later
 * repository's mark wins, deleted files list in repository order).
 */
export function workspaceTones(repos: RepoTones[]): WorkspaceTones {
  return {
    tone: (path) => {
      let best: FileTone | undefined;
      for (const repo of repos) {
        const tone = repo.tones.get(path);
        if (tone && (!best || rank[tone] > rank[best])) {
          best = tone;
        }
      }
      return best;
    },
    mark: (path) => {
      for (let index = repos.length - 1; index >= 0; index--) {
        const mark = repos[index].marks.get(path);
        if (mark) {
          return mark;
        }
      }
      return undefined;
    },
    deletedIn: (dirPath) => {
      const lists = repos.map((repo) => repo.deleted.get(dirPath)).filter((list) => list !== undefined);
      return lists.length === 1 ? lists[0] : lists.flat();
    },
  };
}
