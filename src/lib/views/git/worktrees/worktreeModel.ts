// Pure helpers for worktrees: labels, the default folder of a new worktree and
// the New Worktree dialog's validation.

import { baseName, joinPath, parentOf } from "$lib/stores/workspacePaths";
import type { WorktreeInfo } from "$lib/types";

/** What a worktree has checked out: its branch, a detached commit, or "bare". */
export function worktreeLabel(worktree: WorktreeInfo): string {
  if (worktree.branch) {
    return worktree.branch;
  }
  if (worktree.bare) {
    return "bare";
  }
  return worktree.head ? `detached at ${worktree.head.slice(0, 8)}` : "detached";
}

export function worktreeTooltip(worktree: WorktreeInfo): string {
  const parts = [worktree.path, worktreeLabel(worktree)];
  if (worktree.isMain) {
    parts.push("main worktree");
  }
  if (worktree.isCurrent) {
    parts.push("open here");
  }
  if (worktree.locked) {
    parts.push(worktree.lockReason ? `locked: ${worktree.lockReason}` : "locked");
  }
  if (worktree.prunable) {
    parts.push(worktree.prunableReason ? `prunable: ${worktree.prunableReason}` : "prunable");
  }
  return parts.join(", ");
}

/** A branch name as a folder name: "feature/login" becomes "feature-login". */
export function folderSafe(branchName: string): string {
  return branchName
    .trim()
    .replace(/[/\\:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+/, "");
}

/** "<repo>-<branch>" next to the main worktree, like JetBrains. */
export function defaultWorktreePath(mainRoot: string, branchName: string): string {
  const suffix = folderSafe(branchName);
  const name = suffix ? `${baseName(mainRoot)}-${suffix}` : `${baseName(mainRoot)}-worktree`;
  return joinPath(parentOf(mainRoot), name);
}

/** The main worktree's folder, else the repository's own root. */
export function mainWorktreeRoot(worktrees: WorktreeInfo[], repoRoot: string): string {
  return worktrees.find((worktree) => worktree.isMain && !worktree.bare)?.path ?? repoRoot;
}

export function validateWorktreePath(worktreePath: string, worktrees: WorktreeInfo[]): string | null {
  const trimmed = worktreePath.trim().replace(/\/+$/, "");
  if (trimmed === "") {
    return "Choose a folder for the worktree";
  }
  if (!trimmed.startsWith("/")) {
    return "Use an absolute path";
  }
  if (worktrees.some((worktree) => worktree.path.replace(/\/+$/, "") === trimmed)) {
    return "A worktree already uses this folder";
  }
  return null;
}

/** Local branches a new worktree can check out: git refuses one already checked out elsewhere. */
export function availableBranches(localBranches: string[], worktrees: WorktreeInfo[]): string[] {
  const used = new Set(worktrees.map((worktree) => worktree.branch).filter((branch) => branch !== null));
  return localBranches.filter((branchName) => !used.has(branchName));
}

/** Worktrees to list: the main one first, then by path. */
export function sortedWorktrees(worktrees: WorktreeInfo[]): WorktreeInfo[] {
  return [...worktrees].sort((left, right) => {
    if (left.isMain !== right.isMain) {
      return left.isMain ? -1 : 1;
    }
    return left.path.localeCompare(right.path);
  });
}
