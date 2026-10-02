// Submodule actions for the Git menu's Submodules submenu, the Changes row "..." menu and
// the context menu of a submodule entry in its parent's changes. Each runs in the parent.

import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { joinPath } from "$lib/stores/workspacePaths";
import type { SubmoduleInfo } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { gitDialogs } from "../gitDialogs.svelte";
import { findRepo } from "./submoduleModel";

function activeRoot(): string | null {
  return repoStore.repo?.root ?? null;
}

/** The nested repositories may have appeared (init, add) or gone (remove). */
async function afterChange(): Promise<void> {
  await repoStore.rediscover();
}

export async function initSubmodules(repoRoot: string | null = activeRoot(), submodulePaths: string[] = []): Promise<void> {
  if (!repoRoot) {
    return;
  }
  const done = await repoStore.run("Init submodules", (repoPath) => api.initSubmodules(repoPath, submodulePaths), {
    repoPath: repoRoot,
    success: "Submodules initialized",
  });
  if (done !== undefined) {
    await afterChange();
  }
}

/** `git submodule update --init --recursive`; `remote` moves them to their remote branch's latest commit. */
export async function updateSubmodules(
  repoRoot: string | null = activeRoot(),
  remote = false,
  submodulePaths: string[] = [],
): Promise<void> {
  if (!repoRoot) {
    return;
  }
  const done = await repoStore.run(
    remote ? "Update submodules to latest" : "Update submodules",
    (repoPath) => api.updateSubmodules(repoPath, remote, submodulePaths),
    { repoPath: repoRoot, success: remote ? "Submodules updated to the latest remote commits" : "Submodules updated" },
  );
  if (done !== undefined) {
    await afterChange();
  }
}

export async function syncSubmodules(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot) {
    return;
  }
  await repoStore.run("Sync submodule URLs", (repoPath) => api.syncSubmodules(repoPath), {
    repoPath: repoRoot,
    success: "Submodule URLs synced from .gitmodules",
  });
}

export function openAddSubmoduleDialog(repoRoot: string | null = activeRoot()): void {
  if (repoRoot && repoStore.busy === null) {
    gitDialogs.open({ kind: "addSubmodule", repoRoot });
  }
}

export async function removeSubmodule(repoRoot: string, submodulePath: string): Promise<void> {
  const confirmed = await dialogs.confirm({
    title: "Remove Submodule",
    message: `Remove the submodule ${submodulePath}? It is deinitialized, its folder and cloned repository are deleted, and the removal is staged. Unpushed work inside it is lost.`,
    confirmLabel: "Remove",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  const absolute = joinPath(repoRoot, submodulePath);
  const open = findRepo(repoStore.repos, absolute);
  if (open && repoStore.workspace?.folders.some((folder) => folder.root === open.root) && repoStore.workspace.folders.length > 1) {
    await repoStore.removeFolder(open.root);
  }
  const done = await repoStore.run("Remove submodule", (repoPath) => api.removeSubmodule(repoPath, submodulePath), {
    repoPath: repoRoot,
    success: `Removed submodule ${submodulePath}`,
  });
  if (done !== undefined) {
    await afterChange();
  }
}

/** Makes the submodule the active repository, adding its folder to the workspace when it is not in it. */
export async function openSubmodule(repoRoot: string, submodulePath: string): Promise<void> {
  const absolute = joinPath(repoRoot, submodulePath);
  const open = findRepo(repoStore.repos, absolute);
  if (open) {
    await repoStore.setActiveRepo(open.root);
    return;
  }
  await repoStore.addFolder(absolute);
}

async function pickSubmodule(repoRoot: string, title: string, onlyInitialized: boolean): Promise<SubmoduleInfo | null> {
  const list = (await api.listSubmodules(repoRoot).catch(() => [] as SubmoduleInfo[])).filter(
    (submodule) => !onlyInitialized || submodule.initialized,
  );
  if (list.length === 0) {
    toast.info(onlyInitialized ? "No initialized submodules" : "This repository has no submodules");
    return null;
  }
  if (list.length === 1) {
    return list[0];
  }
  const picked = await dialogs.pick({
    title,
    placeholder: "Select a submodule",
    items: list.map((submodule) => ({
      value: submodule.path,
      label: submodule.path,
      description: submodule.url ?? undefined,
    })),
    emptyText: "No submodules",
  });
  return list.find((submodule) => submodule.path === picked) ?? null;
}

export async function removeSubmoduleFromMenu(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot) {
    return;
  }
  const picked = await pickSubmodule(repoRoot, "Remove Submodule", false);
  if (picked) {
    await removeSubmodule(repoRoot, picked.path);
  }
}

export async function openSubmoduleFromMenu(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot) {
    return;
  }
  const picked = await pickSubmodule(repoRoot, "Open Submodule as Repository", true);
  if (picked) {
    await openSubmodule(repoRoot, picked.path);
  }
}

/** The Submodules submenu of a repository row's "..." menu, from its submodule list. */
export function submoduleMenuItems(repoRoot: string, submodules: SubmoduleInfo[]): MenuItem[] {
  const busy = repoStore.busy !== null;
  const none = submodules.length === 0;
  const uninitialized = submodules.filter((submodule) => !submodule.initialized);
  const initialized = submodules.filter((submodule) => submodule.initialized);
  return [
    { label: "Init", disabled: busy || uninitialized.length === 0, action: () => void initSubmodules(repoRoot) },
    { label: "Update", disabled: busy || none, action: () => void updateSubmodules(repoRoot) },
    { label: "Update to Latest Remote", disabled: busy || none, action: () => void updateSubmodules(repoRoot, true) },
    { label: "Sync URLs", disabled: busy || none, action: () => void syncSubmodules(repoRoot) },
    { separator: true },
    { label: "Add Submodule...", disabled: busy, action: () => openAddSubmoduleDialog(repoRoot) },
    { label: "Remove Submodule...", danger: true, disabled: busy || none, action: () => void removeSubmoduleFromMenu(repoRoot) },
    { separator: true },
    initialized.length > 0
      ? {
          label: "Open as Repository",
          submenu: initialized.map((submodule) => ({
            label: submodule.path,
            action: () => void openSubmodule(repoRoot, submodule.path),
          })),
        }
      : { label: "Open as Repository", disabled: true, action: () => undefined },
  ];
}

/** The context menu items of a submodule entry in its parent's changes. */
export function submoduleEntryItems(repoRoot: string, submodulePath: string): MenuItem[] {
  const busy = repoStore.busy !== null;
  return [
    { label: "Open as Repository", action: () => void openSubmodule(repoRoot, submodulePath) },
    { label: "Update Submodule", disabled: busy, action: () => void updateSubmodules(repoRoot, false, [submodulePath]) },
    {
      label: "Update to Latest Remote",
      disabled: busy,
      action: () => void updateSubmodules(repoRoot, true, [submodulePath]),
    },
  ];
}
