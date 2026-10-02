// Continue, Abort and Skip Commit for the merge, rebase, cherry-pick or revert in progress,
// shared by the conflict banner (OpBanner.svelte) and the Git menu.

import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { dialogs } from "$lib/ui/dialog.svelte";

export async function continueOperation(): Promise<void> {
  await repoStore.runOp("Continue", (repoPath) => api.continueOperation(repoPath), "Operation completed");
}

export async function abortOperation(): Promise<void> {
  const op = repoStore.status?.op;
  const ok = await dialogs.confirm({
    title: "Abort Operation",
    message: `${op?.description ?? "The current operation"} will be aborted and your branch restored to its state before it started.`,
    confirmLabel: "Abort",
    danger: true,
  });
  if (ok) {
    await repoStore.runOp("Abort", (repoPath) => api.abortOperation(repoPath), "Aborted");
  }
}

export async function skipRebaseCommit(): Promise<void> {
  await repoStore.runOp("Skip commit", (repoPath) => api.skipRebaseCommit(repoPath));
}
