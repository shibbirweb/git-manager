// Git LFS actions for the Git menu's LFS submenu and the Changes row "..." menu.
// Without git-lfs installed, every action explains where to get it instead.

import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { LfsStatus } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { updates } from "$lib/update/updates.svelte";
import { validateLfsPattern } from "./lfsModel";
import { LFS_URL, lfsStore } from "./lfsStore.svelte";

function activeRoot(): string | null {
  return repoStore.repo?.root ?? null;
}

/** The LFS state, read now; null (after telling the user) when git-lfs is missing. */
async function requireLfs(repoRoot: string): Promise<LfsStatus | null> {
  const status = await lfsStore.refresh(repoRoot, true);
  if (status?.version) {
    return status;
  }
  const choice = await dialogs.choose<"open" | "cancel">({
    title: "Git LFS Is Not Installed",
    message: "Install git-lfs to use this command, then try again.",
    options: [
      { value: "open", label: "Get Git LFS", description: LFS_URL },
      { value: "cancel", label: "Cancel" },
    ],
  });
  if (choice === "open") {
    await updates.open(LFS_URL);
  }
  return null;
}

export async function trackPattern(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot || !(await requireLfs(repoRoot))) {
    return;
  }
  const result = await dialogs.prompt({
    title: "Track with Git LFS",
    label: "Pattern (added to .gitattributes)",
    placeholder: "*.psd",
    confirmLabel: "Track",
    validate: (value) => validateLfsPattern(value),
  });
  if (!result) {
    return;
  }
  const pattern = result.value.trim();
  await repoStore.run("Track with LFS", (repoPath) => api.lfsTrack(repoPath, pattern), {
    repoPath: repoRoot,
    success: `Tracking ${pattern} with Git LFS`,
  });
  await lfsStore.refresh(repoRoot);
}

export async function untrackPattern(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot) {
    return;
  }
  const status = await requireLfs(repoRoot);
  if (!status) {
    return;
  }
  const pattern = await dialogs.pick({
    title: "Untrack from Git LFS",
    placeholder: "Select a pattern to remove from .gitattributes",
    items: (status.patterns ?? []).map((value) => ({ value, label: value })),
    emptyText: "No LFS patterns in .gitattributes",
  });
  if (pattern === null) {
    return;
  }
  await repoStore.run("Untrack from LFS", (repoPath) => api.lfsUntrack(repoPath, pattern), {
    repoPath: repoRoot,
    success: `No longer tracking ${pattern} with Git LFS`,
  });
  await lfsStore.refresh(repoRoot);
}

/** `git lfs pull` (download and check out) or `git lfs fetch` (download only); progress shows in the status bar. */
export async function transferObjects(repoRoot: string | null = activeRoot(), pull = true): Promise<void> {
  if (!repoRoot || !(await requireLfs(repoRoot))) {
    return;
  }
  await repoStore.run(pull ? "Pull LFS objects" : "Fetch LFS objects", (repoPath) => api.lfsTransfer(repoPath, pull), {
    repoPath: repoRoot,
    success: pull ? "LFS objects pulled" : "LFS objects fetched",
  });
  await lfsStore.refresh(repoRoot);
}

export async function pruneObjects(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot || !(await requireLfs(repoRoot))) {
    return;
  }
  const confirmed = await dialogs.confirm({
    title: "Prune LFS Objects",
    message:
      "Delete local copies of old LFS files that are already on the remote and not needed by recent commits? They are downloaded again when needed.",
    confirmLabel: "Prune",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Prune LFS objects", (repoPath) => api.lfsPrune(repoPath), {
    repoPath: repoRoot,
    success: "Pruned old LFS objects",
  });
}

export async function installHooks(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot || !(await requireLfs(repoRoot))) {
    return;
  }
  await repoStore.run("Install LFS hooks", (repoPath) => api.lfsInstall(repoPath), {
    repoPath: repoRoot,
    success: "Git LFS hooks installed for this repository",
  });
}

/** The LFS submenu of a repository row's "..." menu. */
export function lfsMenuItems(repoRoot: string, status: LfsStatus | null): MenuItem[] {
  const busy = repoStore.busy !== null;
  const used = status?.used ?? false;
  return [
    { label: "Track Pattern...", disabled: busy, action: () => void trackPattern(repoRoot) },
    {
      label: "Untrack Pattern...",
      disabled: busy || (status !== null && (status.patterns ?? []).length === 0),
      action: () => void untrackPattern(repoRoot),
    },
    { separator: true },
    { label: "Pull LFS Objects", disabled: busy || (status !== null && !used), action: () => void transferObjects(repoRoot, true) },
    { label: "Fetch LFS Objects", disabled: busy || (status !== null && !used), action: () => void transferObjects(repoRoot, false) },
    { label: "Prune LFS Objects...", danger: true, disabled: busy || (status !== null && !used), action: () => void pruneObjects(repoRoot) },
    { separator: true },
    { label: "Install Hooks", disabled: busy, action: () => void installHooks(repoRoot) },
  ];
}
