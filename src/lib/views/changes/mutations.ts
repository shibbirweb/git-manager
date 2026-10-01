// Stage, unstage and discard for one repository of the Changes view. Every
// function takes the repository root of the files it acts on.

import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { FileStatus } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { discardPaths, splitPath, unstagePaths, type GroupId } from "./fileStatus";
import { changesLayout } from "./layout.svelte";

export function stage(repoRoot: string, targets: FileStatus[]): void {
  if (targets.length === 0) {
    return;
  }
  changesLayout.focusRepo(repoRoot);
  const filePaths = targets.map((file) => file.path);
  void repoStore.run("Stage", (repoPath) => api.stageFiles(repoPath, filePaths), { repoPath: repoRoot });
}

export function unstage(repoRoot: string, targets: FileStatus[]): void {
  if (targets.length === 0) {
    return;
  }
  changesLayout.focusRepo(repoRoot);
  const filePaths = unstagePaths(targets);
  void repoStore.run("Unstage", (repoPath) => api.unstageFiles(repoPath, filePaths), { repoPath: repoRoot });
}

/** Asks for confirmation, then discards unstaged changes. `repoName` is named in the dialog when given. */
export async function discard(repoRoot: string, targets: FileStatus[], repoName: string | null = null): Promise<void> {
  if (targets.length === 0) {
    return;
  }
  const { trackedPaths, untrackedPaths } = discardPaths(targets);
  const where = repoName ? ` in ${repoName}` : "";
  let message: string;
  if (targets.length === 1) {
    const name = splitPath(targets[0].path).name;
    message =
      untrackedPaths.length === 1
        ? `${name} is untracked and will be deleted. This cannot be undone.`
        : `Unstaged changes to ${name} will be lost. This cannot be undone.`;
  } else {
    const parts = [`Unstaged changes in ${targets.length} files${where} will be lost.`];
    if (untrackedPaths.length > 0) {
      parts.push(
        untrackedPaths.length === 1
          ? "1 untracked file will be deleted."
          : `${untrackedPaths.length} untracked files will be deleted.`,
      );
    }
    parts.push("This cannot be undone.");
    message = parts.join(" ");
  }
  const confirmed = await dialogs.confirm({
    title: targets.length === 1 ? "Discard Changes" : `Discard Changes in ${targets.length} Files`,
    message,
    confirmLabel: "Discard",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  changesLayout.focusRepo(repoRoot);
  await repoStore.run("Discard", (repoPath) => api.discardFiles(repoPath, trackedPaths, untrackedPaths), {
    repoPath: repoRoot,
    success: targets.length === 1 ? "Changes discarded" : `Discarded changes in ${targets.length} files`,
  });
}

/** Enter / double click / Space on a row. */
export function activate(repoRoot: string, file: FileStatus, group: GroupId): void {
  if (group === "conflicts") {
    void repoStore.openMerge(file.path, repoRoot);
  } else if (group === "staged") {
    unstage(repoRoot, [file]);
  } else {
    stage(repoRoot, [file]);
  }
}

export function copyText(text: string): void {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Path copied"))
    .catch((error) => toast.error("Could not copy path", errorMessage(error)));
}
