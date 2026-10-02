// What the repository rows of the Changes view offer, like VS Code's Source
// Control repositories: the branch label, which actions are enabled, the "..."
// menu tree, what the Commit (check) button does and the Commit button's
// dropdown. Pure, so it is tested without the stores.

import type { HeadInfo } from "$lib/types";
import type { MenuItem } from "$lib/ui/menu.svelte";
import type { FileGroups } from "./sections";

export interface RepoActionState {
  busy: boolean;
  /** Current branch; null when detached or not known yet. */
  branch: string | null;
  unborn: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  /** A merge, rebase, cherry-pick or revert is in progress. */
  operation: boolean;
  stagedCount: number;
  /** Unstaged changes, untracked files included. */
  unstagedCount: number;
  /** Unstaged changes to tracked files (what Commit All picks up). */
  trackedCount: number;
  conflictCount: number;
  /** Null while not loaded: the items that need them stay enabled. */
  stashCount: number | null;
  tagCount: number | null;
  remoteCount: number | null;
}

export interface RepoExtras {
  stashCount: number | null;
  tagCount: number | null;
  remoteCount: number | null;
}

export const UNKNOWN_EXTRAS: RepoExtras = {
  stashCount: null,
  tagCount: null,
  remoteCount: null,
};

export function repoActionState(
  head: HeadInfo | null | undefined,
  groups: FileGroups,
  operation: boolean,
  busy: boolean,
  extras: RepoExtras = UNKNOWN_EXTRAS,
): RepoActionState {
  return {
    busy,
    branch: head?.branch ?? null,
    unborn: head?.unborn ?? false,
    upstream: head?.upstream ?? null,
    ahead: head?.ahead ?? 0,
    behind: head?.behind ?? 0,
    operation,
    stagedCount: groups.staged.length,
    unstagedCount: groups.unstaged.length,
    trackedCount: groups.unstaged.filter((file) => file.unstaged !== "untracked").length,
    conflictCount: groups.conflicts.length,
    stashCount: extras.stashCount,
    tagCount: extras.tagCount,
    remoteCount: extras.remoteCount,
  };
}

/**
 * VS Code's branch label decorations: "*" for unstaged changes (untracked
 * files too), "+" for staged changes, "!" for conflicts, e.g. "main*+".
 */
export function branchDecorations(groups: FileGroups): string {
  return (
    (groups.unstaged.length > 0 ? "*" : "") +
    (groups.staged.length > 0 ? "+" : "") +
    (groups.conflicts.length > 0 ? "!" : "")
  );
}

/** Tooltip of the branch button: what the label and its decorations say. */
export function branchTooltip(branchText: string, groups: FileGroups, upstream: string | null): string {
  const parts = [`Branches... (${branchText})`];
  if (groups.unstaged.length > 0) {
    parts.push("* changes");
  }
  if (groups.staged.length > 0) {
    parts.push("+ staged changes");
  }
  if (groups.conflicts.length > 0) {
    parts.push("! conflicts");
  }
  if (upstream) {
    parts.push(`tracking ${upstream}`);
  }
  return parts.join(", ");
}

// Commit (check button and the Commit submenu)

export type CommitMode = "staged" | "all";

export type CommitPlan =
  /** No message yet: put the caret in the commit box, targeting this repository. */
  | { kind: "focus" }
  | { kind: "commit"; mode: CommitMode; amend: boolean }
  /** Nothing staged but tracked changes: ask, then Commit All (VS Code's smart commit). */
  | { kind: "confirmAll" }
  | { kind: "blocked"; reason: string };

export interface DraftState {
  message: string;
  amend: boolean;
}

/** Why nothing can be committed at all, or null. */
export function commitBlocked(state: RepoActionState, amend: boolean): string | null {
  if (state.conflictCount > 0) {
    return "Resolve conflicts before committing";
  }
  if (amend) {
    return state.unborn ? "There is no commit to amend yet" : null;
  }
  return state.stagedCount === 0 && state.unstagedCount === 0 ? "There are no changes to commit" : null;
}

/** What the Commit (check) button and the Commit item do. */
export function commitPlan(state: RepoActionState, draft: DraftState): CommitPlan {
  const blocked = commitBlocked(state, draft.amend);
  if (blocked) {
    return { kind: "blocked", reason: blocked };
  }
  if (draft.message.trim() === "") {
    return { kind: "focus" };
  }
  if (draft.amend || state.stagedCount > 0) {
    return { kind: "commit", mode: "staged", amend: draft.amend };
  }
  if (state.trackedCount > 0) {
    return { kind: "confirmAll" };
  }
  return { kind: "blocked", reason: "Stage the new files to commit them" };
}

export function commitButtonTooltip(plan: CommitPlan): string {
  if (plan.kind === "blocked") {
    return plan.reason;
  }
  if (plan.kind === "focus") {
    return "Commit: write a message first";
  }
  if (plan.kind === "confirmAll") {
    return "Commit all tracked changes";
  }
  return plan.amend ? "Amend the last commit" : "Commit staged changes";
}

/** Commit Staged, Commit All and Commit (Amend) from the menu: the reason they cannot run, or null. */
export function commitModeBlocked(state: RepoActionState, mode: CommitMode, amend = false): string | null {
  const blocked = commitBlocked(state, amend);
  if (blocked || amend) {
    return blocked;
  }
  const count = mode === "staged" ? state.stagedCount : state.stagedCount + state.trackedCount;
  return count === 0 ? "There are no changes to commit" : null;
}

// The Commit button's dropdown

export type CommitChoice = "commit" | "commitPush" | "commitSync" | "amend";
export type CommitFollowUp = "none" | "push" | "sync";

export function commitChoiceSpec(choice: CommitChoice): { amend: boolean; followUp: CommitFollowUp } {
  if (choice === "commitPush") {
    return { amend: false, followUp: "push" };
  }
  if (choice === "commitSync") {
    return { amend: false, followUp: "sync" };
  }
  return { amend: choice === "amend", followUp: "none" };
}

export interface CommitDropdownState {
  busy: boolean;
  /** The Commit button itself can run (staged changes and a message, no conflicts). */
  canCommit: boolean;
  /** HEAD exists and nothing blocks an amend. */
  canAmend: boolean;
  /** The branch can be pushed (a branch, not detached). */
  canPush: boolean;
  /** The box's Amend checkbox is on: pushing right after would need a force push. */
  amendChecked: boolean;
}

export function commitDropdownItems(state: CommitDropdownState, run: (choice: CommitChoice) => void): MenuItem[] {
  const commitDisabled = state.busy || !state.canCommit;
  const pushDisabled = commitDisabled || !state.canPush || state.amendChecked;
  return [
    { label: state.amendChecked ? "Amend Commit" : "Commit", action: () => run("commit"), disabled: commitDisabled },
    { label: "Commit & Push", action: () => run("commitPush"), disabled: pushDisabled },
    { label: "Commit & Sync", action: () => run("commitSync"), disabled: pushDisabled },
    { separator: true },
    { label: "Commit (Amend)", action: () => run("amend"), disabled: state.busy || !state.canAmend },
  ];
}

// The "..." menu

export interface RepoMenuHandlers {
  commit: () => void;
  commitStaged: () => void;
  commitAll: () => void;
  undoLastCommit: () => void;
  commitAmend: () => void;
  stageAll: () => void;
  unstageAll: () => void;
  discardAll: () => void;
  pull: () => void;
  pullRebase: () => void;
  push: () => void;
  forcePush: () => void;
  fetch: () => void;
  fetchPrune: () => void;
  fetchAll: () => void;
  checkoutTo: () => void;
  createBranch: () => void;
  createBranchFrom: () => void;
  renameBranch: () => void;
  deleteBranch: () => void;
  mergeBranch: () => void;
  rebaseBranch: () => void;
  publishBranch: () => void;
  stash: () => void;
  stashIncludeUntracked: () => void;
  applyLatestStash: () => void;
  popLatestStash: () => void;
  applyStash: () => void;
  popStash: () => void;
  dropStash: () => void;
  dropAllStashes: () => void;
  shelveChanges: () => void;
  showShelf: () => void;
  createTag: () => void;
  deleteTag: () => void;
  pushTags: () => void;
  showLog: () => void;
}

/** Unknown counts (null) do not disable anything. */
function none(count: number | null): boolean {
  return count === 0;
}

function countHint(count: number, word: string): string | undefined {
  return count > 0 ? `${count} ${word}` : undefined;
}

export function repoMenuItems(state: RepoActionState, handlers: RepoMenuHandlers): MenuItem[] {
  const busy = state.busy;
  const changes = state.stagedCount + state.unstagedCount;
  const noRemote = none(state.remoteCount);
  const noStash = busy || none(state.stashCount);
  const hasBranch = state.branch !== null && !state.unborn;
  const opBlocked = busy || state.operation;

  const commit: MenuItem[] = [
    {
      label: "Commit",
      action: handlers.commit,
      disabled: busy || commitBlocked(state, false) !== null,
    },
    { label: "Commit Staged", action: handlers.commitStaged, disabled: busy || commitModeBlocked(state, "staged") !== null },
    { label: "Commit All", action: handlers.commitAll, disabled: busy || commitModeBlocked(state, "all") !== null },
    { separator: true },
    { label: "Undo Last Commit", action: handlers.undoLastCommit, disabled: opBlocked || state.unborn },
    {
      label: "Commit (Amend)",
      action: handlers.commitAmend,
      disabled: opBlocked || commitModeBlocked(state, "staged", true) !== null,
    },
  ];

  const changeItems: MenuItem[] = [
    { label: "Stage All Changes", action: handlers.stageAll, disabled: busy || state.unstagedCount === 0 },
    { label: "Unstage All Changes", action: handlers.unstageAll, disabled: busy || state.stagedCount === 0 },
    { label: "Discard All Changes", action: handlers.discardAll, disabled: busy || state.unstagedCount === 0, danger: true },
  ];

  const canPull = hasBranch && state.upstream !== null && !opBlocked;
  const remote: MenuItem[] = [
    { label: "Pull", action: handlers.pull, disabled: !canPull, hint: countHint(state.behind, "behind") },
    { label: "Pull (Rebase)", action: handlers.pullRebase, disabled: !canPull },
    { separator: true },
    {
      label: "Push",
      action: handlers.push,
      disabled: !hasBranch || opBlocked || noRemote,
      hint: countHint(state.ahead, "ahead"),
    },
    {
      label: "Force Push",
      action: handlers.forcePush,
      disabled: !hasBranch || state.upstream === null || opBlocked,
      danger: true,
    },
    { separator: true },
    { label: "Fetch", action: handlers.fetch, disabled: busy || noRemote },
    { label: "Fetch (Prune)", action: handlers.fetchPrune, disabled: busy || noRemote },
    { label: "Fetch From All Remotes", action: handlers.fetchAll, disabled: busy || noRemote },
  ];

  const branch: MenuItem[] = [
    { label: "Checkout to...", action: handlers.checkoutTo, disabled: opBlocked },
    { label: "Create Branch...", action: handlers.createBranch, disabled: busy || state.unborn },
    { label: "Create Branch From...", action: handlers.createBranchFrom, disabled: busy || state.unborn },
    { label: "Rename Branch...", action: handlers.renameBranch, disabled: busy || state.unborn },
    { label: "Delete Branch...", action: handlers.deleteBranch, disabled: busy || state.unborn, danger: true },
    { separator: true },
    { label: "Merge Branch...", action: handlers.mergeBranch, disabled: opBlocked || state.unborn },
    { label: "Rebase Branch...", action: handlers.rebaseBranch, disabled: opBlocked || !hasBranch },
  ];
  if (hasBranch && state.upstream === null) {
    branch.push(
      { separator: true },
      { label: "Publish Branch", action: handlers.publishBranch, disabled: busy || state.operation || noRemote },
    );
  }

  const stashItems: MenuItem[] = [
    { label: "Stash", action: handlers.stash, disabled: busy || state.unborn || changes === 0 },
    {
      label: "Stash (Include Untracked)",
      action: handlers.stashIncludeUntracked,
      disabled: busy || state.unborn || changes === 0,
    },
    { separator: true },
    { label: "Apply Latest Stash", action: handlers.applyLatestStash, disabled: noStash },
    { label: "Pop Latest Stash", action: handlers.popLatestStash, disabled: noStash },
    { separator: true },
    { label: "Apply Stash...", action: handlers.applyStash, disabled: noStash },
    { label: "Pop Stash...", action: handlers.popStash, disabled: noStash },
    { label: "Drop Stash...", action: handlers.dropStash, disabled: noStash, danger: true },
    { label: "Drop All Stashes", action: handlers.dropAllStashes, disabled: noStash, danger: true },
    { separator: true },
    // JetBrains' Shelf: changes put aside as a patch, outside git's stash.
    { label: "Shelve Changes...", action: handlers.shelveChanges, disabled: busy || changes === 0 },
    { label: "Show Shelf", action: handlers.showShelf },
  ];

  const tags: MenuItem[] = [
    { label: "Create Tag...", action: handlers.createTag, disabled: busy || state.unborn },
    { label: "Delete Tag...", action: handlers.deleteTag, disabled: busy || none(state.tagCount), danger: true },
    { label: "Push Tags", action: handlers.pushTags, disabled: busy || noRemote || none(state.tagCount) },
  ];

  return [
    { label: "Commit", submenu: commit },
    { label: "Changes", submenu: changeItems },
    { label: "Pull, Push", submenu: remote },
    { label: "Branch", submenu: branch },
    { label: "Stash", submenu: stashItems },
    { label: "Tags", submenu: tags },
    { separator: true },
    { label: "Show Log", action: handlers.showLog },
  ];
}
