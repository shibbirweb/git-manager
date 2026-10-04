// Fetch, Pull, Push, Stash, Sync, Tags, Commit focus and Show Log, shared by the
// Git menu and the Changes view. Every action takes the repository root it runs
// in; without one it runs in the active repository (the Git menu's target).

import { tick } from "svelte";
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { AppError } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { changesLayout } from "./changes/layout.svelte";
import { changesSelection } from "./changes/selection.svelte";
import { syncDoneMessage, syncPlan } from "./changes/sync";

function headOf(repoRoot?: string) {
  const root = repoRoot ?? repoStore.repo?.root;
  return root ? (repoStore.statuses[root]?.head ?? null) : null;
}

/** Fetches every remote and prunes deleted branches. */
export function fetchAll(repoRoot?: string): Promise<unknown> {
  return repoStore.runOp("Fetch", (repoPath) => api.fetchAll(repoPath), "Fetched all remotes", repoRoot);
}

/** Fetches the default remote; `prune` also drops branches deleted there. */
export function fetchRemote(repoRoot?: string, prune = false): Promise<unknown> {
  return repoStore.runOp("Fetch", (repoPath) => api.fetch(repoPath, prune), prune ? "Fetched and pruned" : "Fetched", repoRoot);
}

export function pull(repoRoot?: string, rebase = false): Promise<unknown> {
  return repoStore.runOp("Pull", (repoPath) => api.pull(repoPath, rebase), rebase ? "Pulled and rebased" : "Pulled", repoRoot);
}

/** Pushes the current branch; `askForce` first offers a force push with --force-with-lease. */
export async function push(askForce = false, repoRoot?: string): Promise<void> {
  let force = false;
  if (askForce) {
    force = await dialogs.confirm({
      title: "Force Push",
      message: `Force push ${headOf(repoRoot)?.branch ?? "this branch"} with --force-with-lease? Commits on the remote that you do not have will be lost.`,
      confirmLabel: "Force Push",
      danger: true,
    });
    if (!force) {
      return;
    }
  }
  await repoStore.runOp("Push", (repoPath) => api.push(repoPath, force), force ? "Force pushed" : "Pushed", repoRoot);
}

/** Pushes a branch that has no upstream yet and tracks it. */
export async function publishBranch(repoRoot?: string): Promise<boolean> {
  const branchName = headOf(repoRoot)?.branch ?? "branch";
  const outcome = await repoStore.runOp("Publish", (repoPath) => api.push(repoPath, false), `Published ${branchName}`, repoRoot);
  return outcome !== undefined;
}

export function pushTags(repoRoot?: string): Promise<unknown> {
  return repoStore.runOp("Push tags", (repoPath) => api.pushTags(repoPath), "Pushed tags", repoRoot);
}

/**
 * Sync Changes: pull what the upstream has, then push what this
 * branch has; a branch without an upstream is published instead. A pull that
 * stops on conflicts stops the sync there (the Conflicts dialog opens).
 * Resolves true when everything went through.
 */
export async function syncRepo(repoRoot: string): Promise<boolean> {
  const plan = syncPlan(repoStore.statuses[repoRoot]?.head);
  if (plan.kind === "none") {
    return true;
  }
  if (plan.kind === "publish") {
    return publishBranch(repoRoot);
  }
  if (plan.pull > 0) {
    const pulled = await repoStore.runOp("Pull", (repoPath) => api.pull(repoPath), undefined, repoRoot);
    if (!pulled || pulled.conflicts) {
      return false;
    }
    await repoStore.refreshRepoStatus(repoRoot);
  }
  // A pull can add a merge commit, so count again before pushing.
  const ahead = repoStore.statuses[repoRoot]?.head?.ahead ?? plan.push;
  if (ahead > 0) {
    const pushed = await repoStore.runOp("Push", (repoPath) => api.push(repoPath, false), undefined, repoRoot);
    if (!pushed) {
      return false;
    }
  }
  toast.success(syncDoneMessage(plan.pull, ahead));
  return true;
}

/**
 * Stashes the changes after asking for a message. With `includeUntracked`
 * undefined the dialog offers it as a checkbox (the Git menu); the Changes
 * view's Stash and Stash (Include Untracked) items decide it up front.
 */
export async function stash(repoRoot?: string, includeUntracked?: boolean): Promise<void> {
  const result = await dialogs.prompt({
    title: includeUntracked ? "Stash (Include Untracked)" : "Stash Changes",
    label: "Message",
    placeholder: "WIP",
    initial: "WIP",
    confirmLabel: "Stash",
    checkbox: includeUntracked === undefined ? { label: "Include untracked files", checked: true } : undefined,
  });
  if (!result) {
    return;
  }
  const withUntracked = includeUntracked ?? result.checked;
  // Nothing to stash comes back as an "invalid" error: a note, not a failure.
  let nothingToStash: string | null = null;
  await repoStore.run(
    "Stash",
    async (repoPath) => {
      try {
        await api.stashPush(repoPath, result.value, withUntracked);
        return true;
      } catch (error) {
        if ((error as Partial<AppError> | null)?.kind === "invalid") {
          nothingToStash = errorMessage(error);
          return false;
        }
        throw error;
      }
    },
    { success: (stashed) => (stashed ? "Changes stashed" : null), repoPath: repoRoot },
  );
  if (nothingToStash) {
    toast.info(nothingToStash);
  }
}

/** Shows the Changes panel and puts the caret in the commit message, targeting `repoRoot` when given. */
export async function focusCommitMessage(repoRoot?: string): Promise<void> {
  if (repoRoot) {
    changesLayout.focusRepo(repoRoot);
  }
  settings.setLeftPanel("changes");
  await tick();
  document.querySelector<HTMLTextAreaElement>(".sidebar textarea[aria-label='Commit message']")?.focus();
}

/** Opens the Log, switching the active repository to `repoRoot` first when given. */
export async function showLog(repoRoot?: string): Promise<void> {
  if (repoRoot) {
    await repoStore.setActiveRepo(repoRoot);
  }
  if (!changesSelection.logShown) {
    changesSelection.toggleLog();
  }
}
