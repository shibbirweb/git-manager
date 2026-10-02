// Pure helpers for submodules: how a submodule's change reads in its parent's
// Changes list (git status wording), and the Add Submodule dialog's checks.

import type { FileStatus, RepoInfo, SubmoduleChange } from "$lib/types";
import { cloneFolderName } from "../gitOptions";

/** "new commits, modified content", like `git status` in the parent; "" when nothing is set. */
export function describeSubmoduleChange(change: SubmoduleChange | null | undefined): string {
  if (!change) {
    return "";
  }
  const parts: string[] = [];
  if (change.newCommits) {
    parts.push("new commits");
  }
  if (change.modifiedContent) {
    parts.push("modified content");
  }
  if (change.untrackedContent) {
    parts.push("untracked content");
  }
  return parts.join(", ");
}

export function isSubmoduleEntry(file: FileStatus): boolean {
  return file.submodule !== null && file.submodule !== undefined;
}

/** Where `git submodule add` puts `url` by default: its humanish name. */
export function defaultSubmodulePath(url: string): string {
  return cloneFolderName(url);
}

/** A path inside the repository: relative, no "..", not an option. */
export function validateSubmodulePath(submodulePath: string, existingPaths: string[]): string | null {
  const trimmed = submodulePath.trim().replace(/\/+$/, "");
  if (trimmed === "") {
    return "Enter a path inside the repository";
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("-")) {
    return "Use a path relative to the repository";
  }
  if (trimmed.split("/").some((part) => part === ".." || part === "." || part === "")) {
    return "Not a valid path";
  }
  if (existingPaths.includes(trimmed)) {
    return "A submodule already uses this path";
  }
  return null;
}

/** The workspace repository at `absolutePath`, if it is open. */
export function findRepo(repos: RepoInfo[], absolutePath: string): RepoInfo | null {
  const wanted = absolutePath.replace(/\/+$/, "");
  return repos.find((repo) => repo.root === wanted) ?? null;
}
