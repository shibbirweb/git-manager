// The log's right-click menu on a commit and the git actions it runs.
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { CommitSummary, ResetMode } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { markFromLog } from "$lib/views/git/bisectActions";
import { startInteractiveRebase } from "$lib/views/git/gitMenuActions";
import { undoAction } from "$lib/views/git/undoActions";

export interface CommitMenuContext {
  repoPath: string | null;
  bisecting: boolean;
  openInTab: (commitId: string) => void;
}

async function copyHash(commit: CommitSummary): Promise<void> {
  try {
    await navigator.clipboard.writeText(commit.id);
    toast.success("Copied revision hash", commit.id);
  } catch (error) {
    toast.error("Could not copy", errorMessage(error));
  }
}

async function newBranchAt(commit: CommitSummary): Promise<void> {
  const result = await dialogs.prompt({
    title: "New Branch",
    label: `Branch name (from ${commit.shortId})`,
    placeholder: "feature/my-change",
    confirmLabel: "Create",
    checkbox: { label: "Checkout branch", checked: true },
    validate: (value) => (/\s|\.\.|[~^:?*[\\]/.test(value) ? "Not a valid branch name" : null),
  });
  if (!result) {
    return;
  }
  await repoStore.run(
    "Create branch",
    (targetRepoPath) => api.createBranch(targetRepoPath, result.value, commit.id, result.checked),
    { success: `Created ${result.value}` },
  );
}

async function checkoutRevision(commit: CommitSummary, repoPath: string | null): Promise<void> {
  const confirmed = await dialogs.confirm({
    title: "Checkout Revision",
    message:
      `Check out ${commit.shortId} in detached HEAD state? ` +
      "New commits there will not belong to any branch until you create one.",
    confirmLabel: "Checkout",
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Checkout", (targetRepoPath) => api.checkoutCommit(targetRepoPath, commit.id), {
    success: `HEAD is now at ${commit.shortId}`,
    action: () => (repoPath ? undoAction(repoPath, ["checkout"]) : null),
  });
}

function cherryPick(commit: CommitSummary): void {
  void repoStore.runOp(
    "Cherry-pick",
    (targetRepoPath) => api.cherryPick(targetRepoPath, commit.id),
    `Cherry-picked ${commit.shortId}`,
  );
}

function revert(commit: CommitSummary): void {
  void repoStore.runOp(
    "Revert",
    (targetRepoPath) => api.revertCommit(targetRepoPath, commit.id),
    `Reverted ${commit.shortId}`,
  );
}

const RESET_MODES: { value: ResetMode; label: string; description: string; danger?: boolean }[] = [
  { value: "soft", label: "Soft", description: "Move the branch only. Changes from later commits stay staged." },
  {
    value: "mixed",
    label: "Mixed",
    description: "Move the branch and reset the index. Changes stay in the working tree, unstaged.",
  },
  {
    value: "hard",
    label: "Hard",
    description: "Move the branch and discard all changes in the index and working tree.",
    danger: true,
  },
  {
    value: "keep",
    label: "Keep",
    description: "Move the branch and reset the files it changes, keeping your local changes.",
  },
];

async function resetHere(commit: CommitSummary, repoPath: string | null): Promise<void> {
  const branch = repoStore.status?.head.branch ?? "HEAD";
  const mode = await dialogs.choose<ResetMode>({
    title: `Reset ${branch} to ${commit.shortId}`,
    message: commit.summary,
    options: RESET_MODES,
  });
  if (!mode) {
    return;
  }
  if (mode === "hard") {
    const confirmed = await dialogs.confirm({
      title: "Hard Reset",
      message: `Reset ${branch} to ${commit.shortId} and discard all uncommitted changes? This cannot be undone.`,
      confirmLabel: "Reset",
      danger: true,
    });
    if (!confirmed) {
      return;
    }
  }
  await repoStore.run("Reset", (targetRepoPath) => api.resetTo(targetRepoPath, commit.id, mode), {
    success: `Reset ${branch} to ${commit.shortId} (${mode})`,
    action: () => (repoPath ? undoAction(repoPath, ["reset"]) : null),
  });
}

export function openCommitMenu(event: MouseEvent, commit: CommitSummary, context: CommitMenuContext): void {
  const { repoPath, bisecting } = context;
  const busy = repoStore.busy !== null;
  const isMerge = commit.parents.length > 1;
  const onBranch = repoStore.status?.head.branch != null;
  const operation = (repoStore.status?.op.kind ?? "none") !== "none";
  const mergeHint = isMerge ? "merge commit" : undefined;
  const bisectHint = bisecting ? undefined : "starts a bisect";
  const items: MenuItem[] = [
    { label: "Open in Tab", hint: "double-click", action: () => context.openInTab(commit.id) },
    { label: "Copy Revision Hash", action: () => void copyHash(commit) },
    { separator: true },
    { label: "New Branch Here...", disabled: busy, action: () => void newBranchAt(commit) },
    { label: "Checkout Revision", disabled: busy, action: () => void checkoutRevision(commit, repoPath) },
    { separator: true },
    { label: "Cherry-Pick", disabled: busy || isMerge, hint: mergeHint, action: () => cherryPick(commit) },
    { label: "Revert Commit", disabled: busy || isMerge, hint: mergeHint, action: () => revert(commit) },
    {
      label: "Interactively Rebase from Here...",
      disabled: busy || isMerge || !onBranch || operation,
      hint: mergeHint,
      action: () => {
        if (repoPath) {
          void startInteractiveRebase(repoPath, commit.id);
        }
      },
    },
    { separator: true },
    { label: "Reset Current Branch to Here...", disabled: busy, action: () => void resetHere(commit, repoPath) },
    { separator: true },
    {
      label: "Bisect: Mark as Good",
      disabled: busy || operation,
      hint: bisectHint,
      action: () => {
        if (repoPath) {
          void markFromLog(repoPath, commit.id, "good");
        }
      },
    },
    {
      label: "Bisect: Mark as Bad",
      disabled: busy || operation,
      hint: bisectHint,
      action: () => {
        if (repoPath) {
          void markFromLog(repoPath, commit.id, "bad");
        }
      },
    },
  ];
  contextMenu.open(event, items);
}
