// New Task and Finish Task, like Orca: a task becomes one worktree per agent (a race when there are several), each
// made ready to run and started with the same first prompt; finishing removes the worktree and its branch.

import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import type { PrepareReport, WorktreeInfo } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { baseName } from "$lib/stores/workspacePaths";
import { aiStore } from "./aiStore.svelte";
import { agentSessions, startAgent } from "./sessions.svelte";
import type { TaskWorktree } from "./taskModel";

export interface TaskPlan {
  repoRoot: string;
  /** The main checkout, where .worktreeinclude and the linked folders live. */
  mainRoot: string;
  baseRef: string;
  /** One worktree per agent; agentId "" makes a worktree with no agent. */
  worktrees: (TaskWorktree & { agentId: string })[];
  prompt: string;
  /** Copy .worktreeinclude paths and link the shared folders. */
  prepare: boolean;
}

export interface TaskResult {
  created: string[];
  /** Why it stopped early, naming the worktree; null when every worktree was made. */
  error: string | null;
}

/** A short line about what preparing copied and linked, for the toast. */
export function prepareSummary(reports: readonly PrepareReport[]): string {
  const copied = new Set(reports.flatMap((report) => report.copied));
  const linked = new Set(reports.flatMap((report) => report.linked));
  const skipped = new Set(reports.flatMap((report) => report.skipped.map((skip) => `${skip.path}: ${skip.reason}`)));
  const parts: string[] = [];
  if (copied.size > 0) {
    parts.push(`Copied ${[...copied].join(", ")}`);
  }
  if (linked.size > 0) {
    parts.push(`linked ${[...linked].join(", ")}`);
  }
  if (skipped.size > 0) {
    parts.push(`skipped ${[...skipped].join("; ")}`);
  }
  return parts.join("; ");
}

/** Makes the task's worktrees one after another, then starts their agents. Stops at the first failure. */
export async function createTask(plan: TaskPlan): Promise<TaskResult> {
  const created: { path: string; agentId: string }[] = [];
  const reports: PrepareReport[] = [];
  let error: string | null = null;
  for (const worktree of plan.worktrees) {
    try {
      const path = await api.addWorktree(plan.repoRoot, worktree.folderPath, {
        kind: "new",
        branchName: worktree.branchName,
        baseRef: plan.baseRef,
      });
      created.push({ path, agentId: worktree.agentId });
      if (plan.prepare) {
        reports.push(await api.prepareWorktree(plan.mainRoot, path, settings.aiWorktreeLinks));
      }
    } catch (failure) {
      error = `${worktree.branchName}: ${errorMessage(failure)}`;
      break;
    }
  }
  await repoStore.refreshRepo(plan.repoRoot, true);
  await aiStore.reload();
  for (const worktree of created) {
    // A cancelled permission question starts none of the rest either.
    if (worktree.agentId && !(await startAgent(worktree.agentId, worktree.path, plan.prompt))) {
      break;
    }
  }
  if (created.length > 0) {
    const count = created.length === 1 ? "a worktree" : `${created.length} worktrees`;
    const summary = prepareSummary(reports);
    toast.success(`Created ${count} from ${plan.baseRef}`, summary || undefined);
  }
  return { created: created.map((worktree) => worktree.path), error };
}

function isUnmergedError(message: string): boolean {
  return /not fully merged/i.test(message);
}

/**
 * Finish Task: closes the worktree's agents, removes the worktree and deletes its branch. Asks first, and again
 * before losing uncommitted changes or a branch that is not merged.
 */
export async function finishTask(repoRoot: string, worktree: WorktreeInfo): Promise<void> {
  const branchName = worktree.branch;
  const inside = agentSessions().filter(
    (session) => session.folderPath === worktree.path || session.folderPath.startsWith(`${worktree.path}/`),
  );
  const dirty = await api.worktreeHasChanges(worktree.path).catch(() => false);
  const parts = [`Remove the worktree ${baseName(worktree.path)}`];
  if (branchName) {
    parts.push(`delete the branch ${branchName}`);
  }
  if (inside.length > 0) {
    parts.unshift(`close ${inside.length === 1 ? "its agent" : `its ${inside.length} agents`}`);
  }
  const confirmed = await dialogs.confirm({
    title: dirty ? "Finish Task with Changes" : "Finish Task",
    message: `${parts.join(", ")}?${dirty ? " It has uncommitted or untracked changes, which will be lost." : ""}`,
    confirmLabel: dirty ? "Finish and Lose Changes" : "Finish Task",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  for (const session of inside) {
    terminalStore.close(session.terminalKey);
  }
  const workspace = repoStore.workspace;
  if (workspace?.folders.some((folder) => folder.root === worktree.path) && workspace.folders.length > 1) {
    await repoStore.removeFolder(worktree.path);
  }
  if (!(await removeWorktreeAsking(repoRoot, worktree.path, dirty))) {
    await aiStore.reload();
    return;
  }
  if (branchName) {
    await deleteBranch(repoRoot, branchName);
  }
  await aiStore.reload();
}

/** Removes the worktree; when git finds files our check did not (say a new link), asks before forcing it. */
async function removeWorktreeAsking(repoRoot: string, worktreePath: string, force: boolean): Promise<boolean> {
  try {
    await api.removeWorktree(repoRoot, worktreePath, force);
    return true;
  } catch (failure) {
    const message = errorMessage(failure);
    if (force || !/modified or untracked files/i.test(message)) {
      toast.error("Could not remove the worktree", message);
      return false;
    }
    const confirmed = await dialogs.confirm({
      title: "Worktree Has Changes",
      message: `${baseName(worktreePath)} has modified or untracked files. Remove it anyway? They will be lost.`,
      confirmLabel: "Remove Anyway",
      danger: true,
    });
    if (!confirmed) {
      return false;
    }
    return api
      .removeWorktree(repoRoot, worktreePath, true)
      .then(() => true)
      .catch((error) => {
        toast.error("Could not remove the worktree", errorMessage(error));
        return false;
      });
  }
}

async function deleteBranch(repoRoot: string, branchName: string): Promise<void> {
  try {
    await api.deleteBranch(repoRoot, branchName, false);
    toast.success(`Finished ${branchName}`, "Worktree removed and branch deleted");
  } catch (failure) {
    const message = errorMessage(failure);
    if (!isUnmergedError(message)) {
      toast.error(`Could not delete the branch ${branchName}`, message);
      return;
    }
    const force = await dialogs.confirm({
      title: "Branch Not Merged",
      message: `${branchName} has commits that are not merged anywhere. Delete it anyway? Those commits will be hard to find.`,
      confirmLabel: "Delete Branch",
      cancelLabel: "Keep Branch",
      danger: true,
    });
    if (force) {
      await api
        .deleteBranch(repoRoot, branchName, true)
        .catch((error) => toast.error("Could not delete the branch", errorMessage(error)));
      toast.success(`Finished ${branchName}`, "Worktree removed and branch deleted");
    } else {
      toast.success("Worktree removed", `The branch ${branchName} stays`);
    }
  } finally {
    await repoStore.refreshRepo(repoRoot, true);
  }
}
