// Path mapping between the workspace folder and the repositories inside it.
// Workspace paths are relative to the workspace root; repo paths are
// relative to a repository root. Both use "/" separators.

import type { RepoInfo } from "$lib/types";

export function joinPath(root: string, relative: string): string {
  if (!relative) {
    return root;
  }
  return root.endsWith("/") ? `${root}${relative}` : `${root}/${relative}`;
}

export function isInside(root: string, absolute: string): boolean {
  return absolute === root || absolute.startsWith(root.endsWith("/") ? root : `${root}/`);
}

export function relativeTo(root: string, absolute: string): string {
  if (absolute === root) {
    return "";
  }
  return absolute.slice(root.endsWith("/") ? root.length : root.length + 1);
}

/** The deepest repository containing an absolute path, or null. */
export function repoForPath(repos: RepoInfo[], absolute: string): RepoInfo | null {
  let best: RepoInfo | null = null;
  for (const repo of repos) {
    if (isInside(repo.root, absolute) && (!best || repo.root.length > best.root.length)) {
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
export function folderFor<T extends FolderRef>(folders: T[], absolute: string): T | null {
  let best: T | null = null;
  for (const folder of folders) {
    if (isInside(folder.root, absolute) && (!best || folder.root.length > best.root.length)) {
      best = folder;
    }
  }
  return best;
}

/** Which repository an absolute path belongs to, and its path inside it. */
export function locateAbsolute(repos: RepoInfo[], absolute: string): RepoLocation | null {
  const repo = repoForPath(repos, absolute);
  if (!repo) {
    return null;
  }
  return { repo, repoPath: relativeTo(repo.root, absolute) };
}

export function parentOf(absolute: string): string {
  const slash = absolute.lastIndexOf("/");
  return slash <= 0 ? "/" : absolute.slice(0, slash);
}

export function baseName(absolute: string): string {
  return absolute.slice(absolute.lastIndexOf("/") + 1);
}

/** Resolves "." and ".." segments and repeated slashes of an absolute path; ".." never goes above "/". */
export function normalizePath(absolute: string): string {
  const parts: string[] = [];
  for (const part of absolute.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return `/${parts.join("/")}`;
}
