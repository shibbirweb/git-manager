// Git > Undo Last Action, the Undo button in success toasts and Restore after a branch is
// deleted. undoPlan.ts decides what can be undone; this asks and runs it.

import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { ReflogAction } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { ToastAction } from "$lib/ui/toast.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { commitDraft } from "../changes/commitDraft.svelte";
import { type DeletedBranch, type HeadSnapshot, restoreStillValid, undoPlan, type UndoPlan, undoStillValid } from "./undoPlan";

/** The latest branch deleted per repository in this session (the tip is gone from the reflog with it). */
const deletedBranches = new Map<string, DeletedBranch>();

export function recordDeletedBranch(repoRoot: string, branchName: string, commitId: string): void {
  if (commitId) {
    deletedBranches.set(repoRoot, { repoRoot, branchName, commitId, deletedAt: Date.now() });
  }
}

export async function restoreBranch(repoRoot: string, branchName: string, commitId: string): Promise<void> {
  await repoStore.run("Restore branch", (repoPath) => api.createBranch(repoPath, branchName, commitId, false), {
    repoPath: repoRoot,
    success: `Restored ${branchName}`,
  });
  const recorded = deletedBranches.get(repoRoot);
  if (recorded?.branchName === branchName) {
    deletedBranches.delete(repoRoot);
  }
}

/** The Restore button of the "Deleted BRANCH" toast. */
export function restoreAction(repoRoot: string, branchName: string, commitId: string): ToastAction | null {
  if (!commitId) {
    return null;
  }
  return {
    label: "Restore",
    run: () => void restoreBranch(repoRoot, branchName, commitId),
    valid: restoreValidity(repoRoot, branchName),
  };
}

async function localBranches(repoRoot: string): Promise<string[]> {
  const refs = repoRoot === repoStore.repo?.root ? repoStore.refs : await api.getRefs(repoRoot).catch(() => null);
  return refs?.local.map((branch) => branch.name) ?? [];
}

async function currentPlan(repoRoot: string): Promise<{ plan: UndoPlan; action: ReflogAction | null }> {
  const last = await api.lastAction(repoRoot).catch(() => null);
  const status = repoStore.statuses[repoRoot] ?? null;
  const plan = undoPlan({
    last,
    op: status?.op.kind ?? "none",
    bisecting: (status?.bisect ?? null) !== null,
    deleted: deletedBranches.get(repoRoot) ?? null,
    localBranches: await localBranches(repoRoot),
  });
  return { plan, action: last?.entry?.action ?? null };
}

function confirmLabel(plan: Exclude<UndoPlan, { kind: "none" }>): string {
  return plan.kind === "restoreBranch" ? "Restore" : "Undo";
}

async function runPlan(repoRoot: string, plan: Exclude<UndoPlan, { kind: "none" }>): Promise<void> {
  if (plan.kind === "restoreBranch") {
    await restoreBranch(repoRoot, plan.branchName, plan.commitId);
    return;
  }
  if (plan.kind === "switchBranch") {
    await repoStore.run(plan.title, (repoPath) => api.checkoutBranch(repoPath, plan.branchName), {
      repoPath: repoRoot,
      success: plan.success,
    });
    return;
  }
  if (plan.kind === "detach") {
    await repoStore.run(plan.title, (repoPath) => api.checkoutCommit(repoPath, plan.commitId), {
      repoPath: repoRoot,
      success: plan.success,
    });
    return;
  }
  // A soft undo of a commit offers its message again, like Undo Last Commit.
  const message = plan.mode === "soft" ? await api.getHeadMessage(repoRoot).catch(() => "") : "";
  const used = await repoStore.run(plan.title, (repoPath) => api.moveHeadBack(repoPath, plan.headId, plan.commitId, plan.mode), {
    repoPath: repoRoot,
    success: (mode) => (mode === "mixed" ? `${plan.success}; local changes kept, files not updated` : plan.success),
  });
  const draft = commitDraft.for(repoRoot);
  if (used === "soft" && message && draft.isBlank()) {
    draft.message = message.trimEnd();
  }
}

/**
 * Git > Undo Last Action asks first. A toast's Undo button (`expected` set) only undoes the
 * action it belongs to, and asks only when the commit is already pushed.
 */
export async function undoLastAction(repoRoot: string | null = repoStore.repo?.root ?? null, expected: readonly ReflogAction[] | null = null): Promise<void> {
  if (!repoRoot) {
    return;
  }
  const { plan, action } = await currentPlan(repoRoot);
  if (plan.kind === "none") {
    toast.info(plan.reason);
    return;
  }
  if (expected !== null && (plan.kind === "restoreBranch" || action === null || !expected.includes(action))) {
    toast.info("Nothing to undo", "The repository changed since then.");
    return;
  }
  const pushed = plan.kind === "moveHead" && plan.pushed;
  if (expected === null || pushed) {
    const confirmed = await dialogs.confirm({
      title: plan.title,
      message: plan.message,
      confirmLabel: confirmLabel(plan),
      danger: pushed,
    });
    if (!confirmed) {
      return;
    }
  }
  await runPlan(repoRoot, plan);
}

/** The Undo button for a success toast after `actions` (Commit, Reset, Checkout...). */
export function undoAction(repoRoot: string, actions: readonly ReflogAction[]): ToastAction {
  return { label: "Undo", run: () => void undoLastAction(repoRoot, actions), valid: undoValidity(repoRoot) };
}

function headSnapshot(repoRoot: string): HeadSnapshot | null {
  const head = repoStore.statuses[repoRoot]?.head ?? null;
  return head ? { shortId: head.shortId, branch: head.branch } : null;
}

/**
 * For a toast's Undo button: captures HEAD now (repoStore.run builds the button after its
 * refresh) and tells later whether the button still undoes what it was made for.
 */
export function undoValidity(repoRoot: string): () => boolean {
  const captured = headSnapshot(repoRoot);
  return () => undoStillValid(captured, headSnapshot(repoRoot));
}

/** For the Restore button after Delete Branch: valid until a branch of that name exists again. */
export function restoreValidity(repoRoot: string, branchName: string): () => boolean {
  return () => {
    const refs = repoRoot === repoStore.repo?.root ? repoStore.refs : null;
    return restoreStillValid(branchName, refs ? refs.local.map((branch) => branch.name) : null);
  };
}
