// Path mapping between the workspace folder and the repositories inside it.
// Workspace paths are relative to the workspace root; repo paths are
// relative to a repository root. Both use "/" separators.
//
// Absolute paths use "/" on every platform: the backend sends Windows paths as
// "C:/Users/me/repo" (src-tauri/src/paths.rs), and fromNativePath converts what
// the system hands the page directly (dialogs, drops).

import type { RepoInfo } from "$lib/types";

const DRIVE_ROOT = /^[A-Za-z]:\//;
const UNC_ROOT = /^\/\/[^/]+\/[^/]+(\/|$)/;

function onWindows(): boolean {
  return typeof navigator !== "undefined" && /Windows/.test(navigator.userAgent);
}

/** A path from the system (a dialog, a drop) in the page's form: on Windows "/" separators and an upper case drive. */
export function fromNativePath(nativePath: string, windows = onWindows()): string {
  if (!windows) {
    return nativePath;
  }
  const slashed = nativePath.replace(/\\/g, "/");
  return /^[a-z]:\//.test(slashed) ? `${slashed[0].toUpperCase()}${slashed.slice(1)}` : slashed;
}

/** "/x", "C:/x" or "//server/share/x". */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || DRIVE_ROOT.test(path);
}

/** The part of an absolute path ".." never goes above: "/", "C:/" or (on Windows) "//server/share/". */
export function rootOf(absolute: string, windows = onWindows()): string {
  if (DRIVE_ROOT.test(absolute)) {
    return absolute.slice(0, 3);
  }
  const unc = windows ? UNC_ROOT.exec(absolute) : null;
  if (unc) {
    return unc[0].endsWith("/") ? unc[0] : `${unc[0]}/`;
  }
  return "/";
}

export function joinPath(root: string, relative: string): string {
  if (!relative) {
    return root;
  }
  return root.endsWith("/") ? `${root}${relative}` : `${root}/${relative}`;
}

/** Windows ignores letter case in paths; Unix file systems may not, so they compare exactly. */
function foldCase(path: string, windows: boolean): string {
  return windows ? path.toLowerCase() : path;
}

/** The same path, in any letter case on Windows. */
export function samePath(first: string, second: string, windows = onWindows()): boolean {
  return foldCase(first, windows) === foldCase(second, windows);
}

export function isInside(root: string, absolute: string, windows = onWindows()): boolean {
  const folded = foldCase(absolute, windows);
  const prefix = foldCase(root.endsWith("/") ? root : `${root}/`, windows);
  return samePath(absolute, root, windows) || folded.startsWith(prefix);
}

export function relativeTo(root: string, absolute: string, windows = onWindows()): string {
  if (samePath(absolute, root, windows)) {
    return "";
  }
  return absolute.slice(root.endsWith("/") ? root.length : root.length + 1);
}

/** The deepest repository containing an absolute path, or null. */
export function repoForPath(repos: RepoInfo[], absolute: string, windows = onWindows()): RepoInfo | null {
  let best: RepoInfo | null = null;
  for (const repo of repos) {
    if (isInside(repo.root, absolute, windows) && (!best || repo.root.length > best.root.length)) {
      best = repo;
    }
  }
  return best;
}

export interface RepoLocation {
  repo: RepoInfo;
  /** Path relative to the repository root. */
  repoPath: string;
}

/** Which repository a workspace path belongs to, and its path inside it. */
export function locate(workspaceRoot: string, repos: RepoInfo[], workspacePath: string): RepoLocation | null {
  const absolute = joinPath(workspaceRoot, workspacePath);
  const repo = repoForPath(repos, absolute);
  if (!repo) {
    return null;
  }
  return { repo, repoPath: relativeTo(repo.root, absolute) };
}

/** A repository path as a workspace path, or null when it lies outside the workspace. */
export function toWorkspacePath(workspaceRoot: string, repoRoot: string, repoPath: string): string | null {
  const absolute = joinPath(repoRoot, repoPath);
  if (!isInside(workspaceRoot, absolute)) {
    return null;
  }
  return relativeTo(workspaceRoot, absolute);
}

export interface FolderRef {
  root: string;
  name: string;
}

/** The workspace folder containing an absolute path (the deepest one when folders nest). */
export function folderFor<T extends FolderRef>(folders: T[], absolute: string, windows = onWindows()): T | null {
  let best: T | null = null;
  for (const folder of folders) {
    if (isInside(folder.root, absolute, windows) && (!best || folder.root.length > best.root.length)) {
      best = folder;
    }
  }
  return best;
}

/** Which repository an absolute path belongs to, and its path inside it. */
export function locateAbsolute(repos: RepoInfo[], absolute: string, windows = onWindows()): RepoLocation | null {
  const repo = repoForPath(repos, absolute, windows);
  if (!repo) {
    return null;
  }
  return { repo, repoPath: relativeTo(repo.root, absolute, windows) };
}

export function parentOf(absolute: string): string {
  const root = rootOf(absolute);
  const slash = absolute.lastIndexOf("/");
  return slash < root.length ? root : absolute.slice(0, slash);
}

export function baseName(absolute: string): string {
  return absolute.slice(absolute.lastIndexOf("/") + 1);
}

/** Resolves "." and ".." segments and repeated slashes of an absolute path; ".." never goes above its root. */
export function normalizePath(absolute: string): string {
  const root = rootOf(absolute);
  const parts: string[] = [];
  for (const part of absolute.slice(root.length).split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return `${root}${parts.join("/")}`;
}

export interface PathMove {
  from: string;
  to: string;
}

/**
 * Where an absolute path is after renames or moves: a moved entry itself, or anything
 * inside a moved folder, takes the new location. Other paths come back unchanged.
 */
export function movedPath(absolute: string, moves: PathMove[], windows = onWindows()): string {
  for (const move of moves) {
    if (samePath(absolute, move.from, windows)) {
      return move.to;
    }
    if (isInside(move.from, absolute, windows)) {
      return joinPath(move.to, relativeTo(move.from, absolute, windows));
    }
  }
  return absolute;
}

/** The paths that are `entries` themselves or lie inside one of them. */
export function pathsUnder(paths: string[], entries: string[], windows = onWindows()): string[] {
  return paths.filter((path) => entries.some((entry) => isInside(entry, path, windows)));
}
