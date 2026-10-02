// Worktree actions for the Branches sidebar and the Git menu's Worktrees submenu.

import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { WorktreeInfo } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { platformName } from "$lib/update/releases";
import { revealLabel } from "../../files/reveal";
import { collapse } from "../../sidebar/collapse.svelte";
import { sectionKey } from "../../sidebar/tree";
import { gitDialogs } from "../gitDialogs.svelte";
import { worktreeLabel } from "./worktreeModel";
import { worktreeStore } from "./worktreeStore.svelte";

function activeRoot(): string | null {
  return repoStore.repo?.root ?? null;
}

async function reload(): Promise<void> {
  await worktreeStore.load(activeRoot());
}

export function openNewWorktreeDialog(repoRoot: string | null = activeRoot()): void {
  if (repoRoot && repoStore.busy === null) {
    gitDialogs.open({ kind: "newWorktree", repoRoot });
  }
}

/** Git > Worktrees > Show Worktrees: the Branches sidebar with the section open. */
export function showWorktrees(): void {
  settings.setLeftPanel("branches");
  collapse.setExpanded(sectionKey("worktrees"), false, true);
  void reload();
}

export async function openWorktreeInWindow(worktree: WorktreeInfo): Promise<void> {
  await repoStore.open(worktree.path);
}

export async function addWorktreeToWorkspace(worktree: WorktreeInfo): Promise<void> {
  await repoStore.addFolder(worktree.path);
}

export async function revealWorktree(worktree: WorktreeInfo): Promise<void> {
  try {
    await revealItemInDir(worktree.path);
  } catch (error) {
    toast.error("Could not reveal the folder", errorMessage(error));
  }
}

export async function lockWorktree(worktree: WorktreeInfo): Promise<void> {
  const result = await dialogs.prompt({
    title: `Lock Worktree '${worktreeLabel(worktree)}'`,
    label: "Reason (optional)",
    placeholder: "On a removable disk",
    confirmLabel: "Lock",
  });
  if (!result) {
    return;
  }
  await repoStore.run("Lock worktree", (repoPath) => api.lockWorktree(repoPath, worktree.path, result.value.trim() || null), {
    success: "Worktree locked",
  });
  await reload();
}

export async function unlockWorktree(worktree: WorktreeInfo): Promise<void> {
  await repoStore.run("Unlock worktree", (repoPath) => api.unlockWorktree(repoPath, worktree.path), {
    success: "Worktree unlocked",
  });
  await reload();
}

/** Asks first; a worktree with changes needs a force removal, which loses them. */
export async function removeWorktree(worktree: WorktreeInfo): Promise<void> {
  const dirty = await api.worktreeHasChanges(worktree.path).catch(() => false);
  const label = worktreeLabel(worktree);
  const confirmed = await dialogs.confirm({
    title: dirty ? "Worktree Has Changes" : "Remove Worktree",
    message: dirty
      ? `${worktree.path} (${label}) has uncommitted or untracked changes. Remove it anyway? The changes will be lost.`
      : `Remove the worktree at ${worktree.path} (${label})? Its folder is deleted; the branch stays.`,
    confirmLabel: dirty ? "Force Remove" : "Remove",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  // Tabs and the workspace folder of a removed worktree would point at nothing.
  const workspace = repoStore.workspace;
  if (workspace?.folders.some((folder) => folder.root === worktree.path) && workspace.folders.length > 1) {
    await repoStore.removeFolder(worktree.path);
  }
  await repoStore.run("Remove worktree", (repoPath) => api.removeWorktree(repoPath, worktree.path, dirty), {
    success: `Removed worktree ${label}`,
  });
  await reload();
}

export async function pruneWorktrees(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot) {
    return;
  }
  const report = await repoStore.run("Prune worktrees", (repoPath) => api.pruneWorktrees(repoPath), {
    repoPath: repoRoot,
    success: (text) => (text.trim() ? "Pruned stale worktrees" : "No stale worktrees to prune"),
  });
  if (report === undefined) {
    return;
  }
  await reload();
}

export function worktreeSectionMenu(): MenuItem[] {
  const busy = repoStore.busy !== null;
  const prunable = worktreeStore.list.some((worktree) => worktree.prunable);
  return [
    { label: "New Worktree...", disabled: busy, action: () => openNewWorktreeDialog() },
    { label: "Prune Stale Worktrees", disabled: busy || !prunable, action: () => void pruneWorktrees() },
  ];
}

export function worktreeMenu(worktree: WorktreeInfo): MenuItem[] {
  const busy = repoStore.busy !== null;
  const inWorkspace = repoStore.workspace?.folders.some((folder) => folder.root === worktree.path) ?? false;
  const missing = worktree.prunable || worktree.bare;
  const items: MenuItem[] = [
    {
      label: "Open in This Window",
      disabled: missing || (worktree.isCurrent && repoStore.workspace?.folders.length === 1),
      action: () => void openWorktreeInWindow(worktree),
    },
    { label: "Add to Workspace", disabled: missing || inWorkspace, action: () => void addWorktreeToWorkspace(worktree) },
    { label: revealLabel(platformName(navigator.userAgent)), disabled: missing, action: () => void revealWorktree(worktree) },
    { separator: true },
  ];
  if (worktree.locked) {
    items.push({ label: "Unlock", disabled: busy, action: () => void unlockWorktree(worktree) });
  } else {
    items.push({ label: "Lock...", disabled: busy || worktree.isMain, action: () => void lockWorktree(worktree) });
  }
  items.push(
    {
      label: worktree.locked ? "Remove (unlock first)" : "Remove...",
      danger: true,
      disabled: busy || worktree.isMain || worktree.isCurrent || worktree.locked || worktree.prunable,
      action: () => void removeWorktree(worktree),
    },
    { separator: true },
    { label: "Prune Stale Worktrees", disabled: busy || !worktreeStore.list.some((entry) => entry.prunable), action: () => void pruneWorktrees() },
  );
  return items;
}
