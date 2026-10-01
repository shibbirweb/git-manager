// Branch, tag and stash actions used by the sidebar rows and context menus.

import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { LocalBranch, RemoteBranch, StashEntry } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";

function currentBranchName(): string | null {
  return repoStore.status?.head.branch ?? repoStore.refs?.local.find((branch) => branch.isHead)?.name ?? null;
}

function headLabel(): string {
  return currentBranchName() ?? "HEAD";
}

function isBusy(): boolean {
  return repoStore.busy !== null;
}

function operationInProgress(): boolean {
  return (repoStore.status?.op.kind ?? "none") !== "none";
}

function localBranchExists(branchName: string): boolean {
  return (repoStore.refs?.local ?? []).some((branch) => branch.name === branchName);
}

export function validateBranchName(branchName: string, allowExisting: string | null = null): string | null {
  const invalid =
    /\s|\.\.|[~^:?*[\\]|@\{|\/\//.test(branchName) ||
    branchName.startsWith("-") ||
    branchName.startsWith("/") ||
    branchName.endsWith("/") ||
    branchName.endsWith(".") ||
    branchName.endsWith(".lock");
  if (invalid) {
    return "Not a valid branch name";
  }
  if (branchName !== allowExisting && localBranchExists(branchName)) {
    return "A branch with this name already exists";
  }
  return null;
}

export function checkoutLocalBranch(branchName: string): void {
  void repoStore.run("Checkout", (repoPath) => api.checkoutBranch(repoPath, branchName), {
    success: `Switched to ${branchName}`,
  });
}

export function checkoutRemoteBranch(remoteBranch: RemoteBranch): void {
  const localName = remoteBranch.branch;
  const message = localBranchExists(localName)
    ? `Switched to ${localName}`
    : `Created ${localName} tracking ${remoteBranch.name}`;
  void repoStore.run("Checkout", (repoPath) => api.checkoutRemoteBranch(repoPath, remoteBranch.name, localName), {
    success: message,
  });
}

export async function checkoutTag(tagName: string): Promise<void> {
  const confirmed = await dialogs.confirm({
    title: "Checkout Tag",
    message: `Check out tag '${tagName}'? HEAD will be detached; create a branch to keep new commits.`,
    confirmLabel: "Checkout",
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Checkout", (repoPath) => api.checkoutCommit(repoPath, `refs/tags/${tagName}`), {
    success: `HEAD detached at ${tagName}`,
  });
}

export async function newBranchFrom(startPoint: string | null, initialName = ""): Promise<void> {
  const result = await dialogs.prompt({
    title: startPoint ? `New Branch from '${startPoint}'` : "Create New Branch",
    label: "Branch name",
    placeholder: "feature/my-change",
    initial: initialName,
    confirmLabel: "Create",
    checkbox: { label: "Checkout branch", checked: true },
    validate: (value) => validateBranchName(value.trim()),
  });
  if (!result) {
    return;
  }
  await repoStore.run("Create branch", (repoPath) => api.createBranch(repoPath, result.value, startPoint, result.checked), {
    success: result.checked ? `Created and switched to ${result.value}` : `Created ${result.value}`,
  });
}

export function mergeIntoCurrent(refName: string): void {
  const target = headLabel();
  void repoStore.runOp("Merge", (repoPath) => api.mergeBranch(repoPath, refName), `Merged ${refName} into ${target}`);
}

export function rebaseCurrentOnto(refName: string): void {
  const target = headLabel();
  void repoStore.runOp("Rebase", (repoPath) => api.rebaseOnto(repoPath, refName), `Rebased ${target} onto ${refName}`);
}

export async function renameLocalBranch(branchName: string): Promise<void> {
  const result = await dialogs.prompt({
    title: `Rename Branch '${branchName}'`,
    label: "New name",
    initial: branchName,
    confirmLabel: "Rename",
    validate: (value) => validateBranchName(value.trim(), branchName),
  });
  if (!result || result.value === branchName) {
    return;
  }
  await repoStore.run("Rename branch", (repoPath) => api.renameBranch(repoPath, branchName, result.value), {
    success: `Renamed ${branchName} to ${result.value}`,
  });
}

export async function deleteLocalBranch(branchName: string): Promise<void> {
  if (branchName === currentBranchName()) {
    return;
  }
  const confirmed = await dialogs.confirm({
    title: "Delete Branch",
    message: `Delete local branch '${branchName}'?`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  let notFullyMerged = false;
  await repoStore.run(
    "Delete branch",
    async (repoPath) => {
      try {
        await api.deleteBranch(repoPath, branchName, false);
        return true;
      } catch (error) {
        if (/not fully merged/i.test(errorMessage(error))) {
          notFullyMerged = true;
          return false;
        }
        throw error;
      }
    },
    { success: (deleted) => (deleted ? `Deleted ${branchName}` : null) },
  );
  if (!notFullyMerged) {
    return;
  }
  const force = await dialogs.confirm({
    title: "Branch Not Fully Merged",
    message: `'${branchName}' has commits that are not merged into its upstream or HEAD. Delete it anyway? Those commits may be lost.`,
    confirmLabel: "Force Delete",
    danger: true,
  });
  if (!force) {
    return;
  }
  await repoStore.run("Delete branch", (repoPath) => api.deleteBranch(repoPath, branchName, true), {
    success: `Deleted ${branchName}`,
  });
}

export function applyStash(stashIndex: number, pop: boolean): void {
  const label = pop ? "Pop stash" : "Apply stash";
  const message = pop ? `Popped stash@{${stashIndex}}` : `Applied stash@{${stashIndex}}`;
  void repoStore.runOp(label, (repoPath) => api.stashApply(repoPath, stashIndex, pop), message);
}

export async function dropStash(stash: StashEntry): Promise<void> {
  const confirmed = await dialogs.confirm({
    title: "Drop Stash",
    message: `Drop stash@{${stash.index}} (${stash.message})? This cannot be undone.`,
    confirmLabel: "Drop",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Drop stash", (repoPath) => api.stashDrop(repoPath, stash.index), {
    success: `Dropped stash@{${stash.index}}`,
  });
}

export function localSectionMenu(): MenuItem[] {
  return [{ label: "New Branch...", disabled: isBusy(), action: () => void newBranchFrom(null) }];
}

export function localBranchMenu(branch: LocalBranch): MenuItem[] {
  const busy = isBusy();
  const current = branch.isHead;
  const head = headLabel();
  const opBlocked = busy || operationInProgress();
  return [
    { label: "Checkout", disabled: busy || current, action: () => checkoutLocalBranch(branch.name) },
    { label: `New Branch from '${branch.name}'...`, disabled: busy, action: () => void newBranchFrom(branch.name) },
    { separator: true },
    {
      label: `Merge '${branch.name}' into '${head}'`,
      disabled: opBlocked || current,
      action: () => mergeIntoCurrent(branch.name),
    },
    {
      label: `Rebase '${head}' onto '${branch.name}'`,
      disabled: opBlocked || current,
      action: () => rebaseCurrentOnto(branch.name),
    },
    { separator: true },
    { label: "Rename...", disabled: busy, action: () => void renameLocalBranch(branch.name) },
    { label: "Delete", danger: true, disabled: busy || current, action: () => void deleteLocalBranch(branch.name) },
  ];
}

export function remoteBranchMenu(remoteBranch: RemoteBranch): MenuItem[] {
  const busy = isBusy();
  const head = headLabel();
  const opBlocked = busy || operationInProgress();
  const current = (repoStore.refs?.local ?? []).find((branch) => branch.isHead) ?? null;
  const alreadyOn = current?.name === remoteBranch.branch && current?.upstream === remoteBranch.name;
  return [
    { label: "Checkout", disabled: busy || alreadyOn, action: () => checkoutRemoteBranch(remoteBranch) },
    {
      label: `New Branch from '${remoteBranch.name}'...`,
      disabled: busy,
      action: () => void newBranchFrom(remoteBranch.name, remoteBranch.branch),
    },
    { separator: true },
    {
      label: `Merge '${remoteBranch.name}' into '${head}'`,
      disabled: opBlocked,
      action: () => mergeIntoCurrent(remoteBranch.name),
    },
    {
      label: `Rebase '${head}' onto '${remoteBranch.name}'`,
      disabled: opBlocked,
      action: () => rebaseCurrentOnto(remoteBranch.name),
    },
  ];
}

export function tagMenu(tagName: string): MenuItem[] {
  const busy = isBusy();
  return [
    { label: "Checkout", disabled: busy, action: () => void checkoutTag(tagName) },
    { label: `New Branch from '${tagName}'...`, disabled: busy, action: () => void newBranchFrom(tagName) },
    { separator: true },
    {
      label: `Merge '${tagName}' into '${headLabel()}'`,
      disabled: busy || operationInProgress(),
      action: () => mergeIntoCurrent(tagName),
    },
  ];
}

export function stashMenu(stash: StashEntry): MenuItem[] {
  const busy = isBusy();
  return [
    { label: "Apply", disabled: busy, action: () => applyStash(stash.index, false) },
    { label: "Pop", disabled: busy, action: () => applyStash(stash.index, true) },
    { separator: true },
    { label: "Drop...", danger: true, disabled: busy, action: () => void dropStash(stash) },
  ];
}
