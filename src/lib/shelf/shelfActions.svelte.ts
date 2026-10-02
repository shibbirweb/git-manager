// What the Shelf does: Shelve Changes (a dialog), Show Shelf (the bottom panel's Shelf tab),
// Unshelve, Show Diff, Rename and Delete. Every action takes the repository root it acts on.

import { api } from "$lib/api";
import { gitTabPath } from "$lib/stores/gitTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import type { ShelfEntry } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { gitDialogs } from "$lib/views/git/gitDialogs.svelte";
import { fileCountLabel } from "./shelfModel";

class ShelfState {
  /** Bumped after every change to a shelf, so the Shelf tab reloads. */
  version = $state(0);

  changed(): void {
    this.version += 1;
  }
}

export const shelfState = new ShelfState();

/** Shelve Changes...: `filePaths` start ticked; null ticks every changed file. */
export function openShelveDialog(repoRoot: string | null = repoStore.repo?.root ?? null, filePaths: string[] | null = null): void {
  if (!repoRoot || repoStore.busy !== null) {
    return;
  }
  gitDialogs.open({ kind: "shelve", repoRoot, filePaths });
}

/** Show Shelf: the Shelf tab of the bottom panel. */
export function showShelf(): void {
  terminalStore.showTab("shelf");
}

export async function shelveFiles(repoRoot: string, name: string, filePaths: string[], keepInWorkingTree: boolean): Promise<boolean> {
  const entry = await repoStore.run("Shelve", (repoPath) => api.shelveChanges(repoPath, name, filePaths, keepInWorkingTree), {
    repoPath: repoRoot,
    success: (shelved) => `Shelved ${fileCountLabel(shelved.files.length)}`,
  });
  shelfState.changed();
  return entry !== undefined;
}

/** Unshelve...: all files, or `filePaths` of them; asks whether to keep them on the shelf. */
export async function unshelveEntry(repoRoot: string, entry: ShelfEntry, filePaths: string[] | null = null): Promise<void> {
  const count = filePaths?.length ?? entry.files.length;
  const choice = await dialogs.choose<"remove" | "keep">({
    title: filePaths ? "Unshelve Selected Files" : "Unshelve Changes",
    message: `Apply ${fileCountLabel(count)} of "${entry.name}" to the working tree.`,
    options: [
      { value: "remove", label: "Unshelve", description: "Then remove the applied files from the shelf" },
      { value: "keep", label: "Unshelve and Keep on Shelf", description: "The shelved changes stay for later" },
    ],
  });
  if (!choice) {
    return;
  }
  await repoStore.runOp(
    "Unshelve",
    (repoPath) => api.unshelve(repoPath, entry.id, filePaths, choice === "remove"),
    `Unshelved ${fileCountLabel(count)}`,
    repoRoot,
  );
  shelfState.changed();
}

export async function renameEntry(repoRoot: string, entry: ShelfEntry): Promise<void> {
  const result = await dialogs.prompt({
    title: "Rename Shelved Changes",
    label: "Name",
    initial: entry.name,
    confirmLabel: "Rename",
    validate: (value) => (value.trim() ? null : "Enter a name"),
  });
  if (!result || result.value.trim() === entry.name) {
    return;
  }
  await repoStore.run("Rename shelved changes", (repoPath) => api.renameShelf(repoPath, entry.id, result.value), {
    repoPath: repoRoot,
    refresh: false,
  });
  shelfState.changed();
}

export async function deleteEntry(repoRoot: string, entry: ShelfEntry): Promise<void> {
  const confirmed = await dialogs.confirm({
    title: "Delete Shelved Changes",
    message: `Delete "${entry.name}" (${fileCountLabel(entry.files.length)}) from the shelf? This cannot be undone.`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Delete shelved changes", (repoPath) => api.deleteShelf(repoPath, entry.id), {
    repoPath: repoRoot,
    refresh: false,
    success: "Shelved changes deleted",
  });
  shelfState.changed();
}

/** Show Diff: the shelved change of one file, read-only, in an editor tab. */
export function showShelvedDiff(repoRoot: string, shelfId: string, filePath: string): void {
  repoStore.openPseudoTab(gitTabPath({ kind: "shelf", repoRoot, filePath, shelfId }));
}
