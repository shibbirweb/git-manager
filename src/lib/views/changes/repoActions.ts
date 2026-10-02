// The actions of a repository row in the Changes view (VS Code's Source Control
// repository actions). Each runs in the row's repository, never just the active one.

import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { Refs, StashEntry } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { fetchAll, fetchRemote, focusCommitMessage, publishBranch, pull, push, pushTags, showLog, stash, syncRepo } from "../gitActions";
import { withRepoExtras } from "../git/repoExtras";
import {
  applyStash,
  checkoutLocalBranch,
  checkoutRemoteBranch,
  checkoutTag,
  deleteLocalBranch,
  dropStash,
  newBranchFrom,
  renameLocalBranch,
  repoTarget,
  type RepoTarget,
} from "../sidebar/actions";
import { gitDialogs } from "../git/gitDialogs.svelte";
import { commitDraft } from "./commitDraft.svelte";
import { commitOptions } from "./commitOptions.svelte";
import { discard, stage, unstage } from "./mutations";
import {
  commitPlan,
  type CommitFollowUp,
  type CommitMode,
  type RepoActionState,
  repoActionState,
  type RepoExtras,
  type RepoMenuHandlers,
  repoMenuItems,
  UNKNOWN_EXTRAS,
} from "./repoMenu";
import {
  checkoutPickItems,
  decodeRefPick,
  pickedStash,
  refPickItems,
  stashPickItems,
  tagPickItems,
  validateTagName,
} from "./repoPickers";
import { buildSection, type RepoSection } from "./sections";
import { rowSync } from "./sync";
import { openShelveDialog, showShelf } from "$lib/shelf/shelfActions.svelte";

/** Branches, tags and stashes of one repository, read when a menu or picker opens. */
export interface RepoDetails {
  refs: Refs | null;
  stashes: StashEntry[] | null;
}

export async function loadDetails(repoRoot: string): Promise<RepoDetails> {
  // The active repository's lists are kept fresh by the store.
  if (repoRoot === repoStore.repo?.root && repoStore.refs) {
    return { refs: repoStore.refs, stashes: repoStore.stashes };
  }
  const [refs, stashes] = await Promise.all([
    api.getRefs(repoRoot).catch(() => null),
    api.getStashes(repoRoot).catch(() => null),
  ]);
  return { refs, stashes };
}

function extrasOf(details: RepoDetails): RepoExtras {
  return {
    stashCount: details.stashes?.length ?? null,
    tagCount: details.refs ? details.refs.tags.length : null,
    remoteCount: details.refs ? details.refs.remotes.length : null,
  };
}

/** The repository's section built from the latest status (cached per status object). */
function currentSection(repoRoot: string): RepoSection | null {
  const repo = repoStore.repos.find((candidate) => candidate.root === repoRoot) ?? null;
  return repo ? buildSection(repo, repoStore.statuses[repoRoot] ?? null) : null;
}

export function stateOf(section: RepoSection, extras: RepoExtras = UNKNOWN_EXTRAS): RepoActionState {
  const operation = (section.status?.op?.kind ?? "none") !== "none";
  return repoActionState(section.status?.head, section, operation, repoStore.busy !== null, extras);
}

function repoName(repoRoot: string): string {
  return repoStore.repos.find((repo) => repo.root === repoRoot)?.name ?? "repository";
}

// Commit

export interface CommitRequest {
  mode: CommitMode;
  amend: boolean;
  followUp: CommitFollowUp;
}

/**
 * Commits `repoRoot` with its commit box draft, then pushes or syncs when asked.
 * A failed commit stops there. Without a message (and not amending) the commit
 * box gets the caret instead.
 */
export async function commitRepo(repoRoot: string, request: CommitRequest): Promise<boolean> {
  const draft = commitDraft.for(repoRoot);
  const message = draft.message;
  if (!request.amend && message.trim() === "") {
    toast.info("Write a commit message first");
    await focusCommitMessage(repoRoot);
    return false;
  }
  const options = commitOptions.request(repoRoot);
  if (!options) {
    return false;
  }
  const result = await repoStore.run(
    "Commit",
    (repoPath) =>
      request.mode === "all"
        ? api.commitAll(repoPath, message, request.amend, options)
        : api.commit(repoPath, message, request.amend, options),
    { repoPath: repoRoot, success: request.amend ? "Commit amended" : "Committed" },
  );
  if (result === undefined) {
    return false;
  }
  draft.clear();
  if (request.followUp === "push") {
    await push(false, repoRoot);
  } else if (request.followUp === "sync") {
    await syncRepo(repoRoot);
  }
  return true;
}

/** The row's Commit (check) button and the Commit item: commit, ask to commit all, or focus the box. */
export async function commitFromRow(repoRoot: string): Promise<void> {
  const section = currentSection(repoRoot);
  if (!section) {
    return;
  }
  const draft = commitDraft.for(repoRoot);
  const plan = commitPlan(stateOf(section), draft);
  if (plan.kind === "focus") {
    await focusCommitMessage(repoRoot);
  } else if (plan.kind === "blocked") {
    toast.info(plan.reason);
  } else if (plan.kind === "confirmAll") {
    const confirmed = await dialogs.confirm({
      title: "Commit All",
      message: "There are no staged changes. Stage all changes to tracked files and commit them?",
      confirmLabel: "Commit All",
    });
    if (confirmed) {
      await commitRepo(repoRoot, { mode: "all", amend: false, followUp: "none" });
    }
  } else {
    await commitRepo(repoRoot, { mode: plan.mode, amend: plan.amend, followUp: "none" });
  }
}

export async function undoLastCommit(repoRoot: string): Promise<void> {
  const head = repoStore.statuses[repoRoot]?.head ?? null;
  const parts = [`Undo the last commit${head?.branch ? ` on ${head.branch}` : ""} in ${repoName(repoRoot)}? Its changes stay staged.`];
  if (head?.upstream && head.ahead === 0) {
    parts.push(`It is already on ${head.upstream}, so pushing afterwards needs a force push.`);
  }
  const confirmed = await dialogs.confirm({
    title: "Undo Last Commit",
    message: parts.join(" "),
    confirmLabel: "Undo Commit",
  });
  if (!confirmed) {
    return;
  }
  const message = await repoStore.run("Undo commit", (repoPath) => api.undoLastCommit(repoPath), {
    repoPath: repoRoot,
    success: "Undid the last commit; its changes are staged",
  });
  // Like VS Code: offer the message again for the next commit.
  const draft = commitDraft.for(repoRoot);
  if (message !== undefined && draft.message.trim() === "") {
    draft.message = message.trimEnd();
  }
}

// Sync and refresh

/** The row's Sync button: publish, sync, or (in step) pull whatever the remote has. */
export async function syncFromRow(repoRoot: string): Promise<void> {
  const sync = rowSync(repoStore.statuses[repoRoot]?.head);
  if (sync.kind === "publish") {
    await publishBranch(repoRoot);
  } else if (sync.kind === "sync" && sync.pull === 0 && sync.push === 0) {
    await pull(repoRoot);
  } else if (sync.kind === "sync") {
    await syncRepo(repoRoot);
  }
}

/** Status of the repository, plus branches and stashes when it is the active one. */
export function refreshRepoRow(repoRoot: string): Promise<void> {
  return repoStore.refreshRepo(repoRoot, true);
}

// Branch pickers

function remoteBranchOf(target: RepoTarget, remoteName: string) {
  return target.refs?.remote.find((remoteBranch) => remoteBranch.name === remoteName) ?? null;
}

export async function checkoutTo(target: RepoTarget, repoRoot: string): Promise<void> {
  const value = await dialogs.pick({
    title: `Checkout to... (${repoName(repoRoot)})`,
    placeholder: "Select a branch or tag to check out",
    items: checkoutPickItems(target.refs),
  });
  const picked = decodeRefPick(value);
  if (!picked) {
    return;
  }
  if (picked.kind === "create") {
    await newBranchFrom(null, "", target);
  } else if (picked.kind === "createFrom") {
    await createBranchFrom(target, repoRoot);
  } else if (picked.kind === "local") {
    checkoutLocalBranch(picked.name, target);
  } else if (picked.kind === "remote") {
    const remoteBranch = remoteBranchOf(target, picked.name);
    if (remoteBranch) {
      checkoutRemoteBranch(remoteBranch, target);
    }
  } else {
    await checkoutTag(picked.name, target);
  }
}

/** Picks a ref; `skipCurrent` leaves out the checked-out branch. Resolves with its name and kind. */
async function pickRef(
  target: RepoTarget,
  title: string,
  placeholder: string,
  options: { remote: boolean; tags: boolean; skipCurrent: boolean },
) {
  const value = await dialogs.pick({
    title,
    placeholder,
    items: refPickItems(target.refs, { local: true, ...options }),
    emptyText: "No other branches",
  });
  return decodeRefPick(value);
}

export async function createBranchFrom(target: RepoTarget, repoRoot: string): Promise<void> {
  const picked = await pickRef(target, `Create Branch From... (${repoName(repoRoot)})`, "Select a ref to create the branch from", {
    remote: true,
    tags: true,
    skipCurrent: false,
  });
  if (!picked || picked.kind === "create" || picked.kind === "createFrom") {
    return;
  }
  const initialName = picked.kind === "remote" ? (remoteBranchOf(target, picked.name)?.branch ?? "") : "";
  await newBranchFrom(picked.name, initialName, target);
}

/** Renames the current branch, like VS Code; with a detached HEAD, asks which branch. */
export async function renameBranch(target: RepoTarget, repoRoot: string): Promise<void> {
  const current = repoStore.statuses[repoRoot]?.head.branch ?? null;
  if (current) {
    await renameLocalBranch(current, target);
    return;
  }
  const picked = await pickRef(target, "Rename Branch...", "Select a branch to rename", {
    remote: false,
    tags: false,
    skipCurrent: false,
  });
  if (picked?.kind === "local") {
    await renameLocalBranch(picked.name, target);
  }
}

export async function deleteBranch(target: RepoTarget, repoRoot: string): Promise<void> {
  const picked = await pickRef(target, `Delete Branch... (${repoName(repoRoot)})`, "Select a branch to delete", {
    remote: false,
    tags: false,
    skipCurrent: true,
  });
  if (picked?.kind === "local") {
    await deleteLocalBranch(picked.name, target);
  }
}

/** JetBrains' Merge dialog: the branch to merge and the merge options. */
export function mergeBranch(repoRoot: string, branchName: string | null = null): void {
  gitDialogs.open({ kind: "merge", repoRoot, branchName });
}

/** JetBrains' Rebase dialog: what to rebase onto and the rebase options. */
export function rebaseBranch(repoRoot: string, onto: string | null = null): void {
  gitDialogs.open({ kind: "rebaseBranch", repoRoot, onto });
}

// Stashes

async function pickStash(repoRoot: string, stashes: StashEntry[] | null, title: string): Promise<StashEntry | null> {
  const list = stashes ?? (await api.getStashes(repoRoot).catch(() => [] as StashEntry[]));
  const value = await dialogs.pick({
    title: `${title} (${repoName(repoRoot)})`,
    placeholder: "Select a stash",
    items: stashPickItems(list),
    emptyText: "No stashes",
  });
  return pickedStash(list, value);
}

export async function dropAllStashes(repoRoot: string, stashCount: number | null): Promise<void> {
  const count = stashCount === null ? "every stash" : stashCount === 1 ? "1 stash" : `all ${stashCount} stashes`;
  const confirmed = await dialogs.confirm({
    title: "Drop All Stashes",
    message: `Drop ${count} in ${repoName(repoRoot)}? This cannot be undone.`,
    confirmLabel: "Drop All",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Drop stashes", (repoPath) => api.stashClear(repoPath), {
    repoPath: repoRoot,
    success: "Dropped all stashes",
  });
}

// Tags

export async function createTag(repoRoot: string, refs: Refs | null): Promise<void> {
  const existing = refs?.tags ?? [];
  const result = await dialogs.prompt({
    title: `Create Tag (${repoName(repoRoot)})`,
    label: "Tag name",
    placeholder: "v1.0.0",
    confirmLabel: "Create Tag",
    secondary: { label: "Message (optional: makes an annotated tag)", placeholder: "Release notes" },
    validate: (value) => validateTagName(value.trim(), existing),
  });
  if (!result) {
    return;
  }
  const message = result.secondary === "" ? null : result.secondary;
  await repoStore.run("Create tag", (repoPath) => api.createTag(repoPath, result.value, message), {
    repoPath: repoRoot,
    success: `Created tag ${result.value}`,
  });
}

export async function deleteTag(repoRoot: string, refs: Refs | null): Promise<void> {
  const tags = refs?.tags ?? [];
  const tagName = await dialogs.pick({
    title: `Delete Tag... (${repoName(repoRoot)})`,
    placeholder: "Select a tag to delete",
    items: tagPickItems(tags),
    emptyText: "No tags",
  });
  if (tagName === null) {
    return;
  }
  const confirmed = await dialogs.confirm({
    title: "Delete Tag",
    message: `Delete the local tag '${tagName}'? A copy already pushed stays on the remote.`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Delete tag", (repoPath) => api.deleteTag(repoPath, tagName), {
    repoPath: repoRoot,
    success: `Deleted tag ${tagName}`,
  });
}

// The "..." menu

function handlersFor(repoRoot: string, details: RepoDetails): RepoMenuHandlers {
  const target = repoTarget(repoRoot, details.refs);
  /** Stage, unstage and discard read the files at click time. */
  const files = () => currentSection(repoRoot);
  return {
    commit: () => void commitFromRow(repoRoot),
    commitStaged: () => void commitRepo(repoRoot, { mode: "staged", amend: false, followUp: "none" }),
    commitAll: () => void commitRepo(repoRoot, { mode: "all", amend: false, followUp: "none" }),
    undoLastCommit: () => void undoLastCommit(repoRoot),
    commitAmend: () => void commitRepo(repoRoot, { mode: "staged", amend: true, followUp: "none" }),
    stageAll: () => stage(repoRoot, files()?.unstaged ?? []),
    unstageAll: () => unstage(repoRoot, files()?.staged ?? []),
    discardAll: () => void discard(repoRoot, files()?.unstaged ?? [], repoName(repoRoot)),
    pull: () => void pull(repoRoot),
    pullRebase: () => void pull(repoRoot, true),
    push: () => void push(false, repoRoot),
    forcePush: () => void push(true, repoRoot),
    fetch: () => void fetchRemote(repoRoot),
    fetchPrune: () => void fetchRemote(repoRoot, true),
    fetchAll: () => void fetchAll(repoRoot),
    checkoutTo: () => void checkoutTo(target, repoRoot),
    createBranch: () => void newBranchFrom(null, "", target),
    createBranchFrom: () => void createBranchFrom(target, repoRoot),
    renameBranch: () => void renameBranch(target, repoRoot),
    deleteBranch: () => void deleteBranch(target, repoRoot),
    mergeBranch: () => mergeBranch(repoRoot),
    rebaseBranch: () => rebaseBranch(repoRoot),
    publishBranch: () => void publishBranch(repoRoot),
    stash: () => void stash(repoRoot, false),
    stashIncludeUntracked: () => void stash(repoRoot, true),
    applyLatestStash: () => void applyStash(0, false, repoRoot),
    popLatestStash: () => void applyStash(0, true, repoRoot),
    applyStash: () =>
      void pickStash(repoRoot, details.stashes, "Apply Stash").then((picked) =>
        picked ? applyStash(picked.index, false, repoRoot) : undefined,
      ),
    popStash: () =>
      void pickStash(repoRoot, details.stashes, "Pop Stash").then((picked) =>
        picked ? applyStash(picked.index, true, repoRoot) : undefined,
      ),
    dropStash: () =>
      void pickStash(repoRoot, details.stashes, "Drop Stash").then((picked) =>
        picked ? dropStash(picked, repoRoot) : undefined,
      ),
    dropAllStashes: () => void dropAllStashes(repoRoot, details.stashes?.length ?? null),
    shelveChanges: () => openShelveDialog(repoRoot),
    showShelf: () => showShelf(),
    createTag: () => void createTag(repoRoot, details.refs),
    deleteTag: () => void deleteTag(repoRoot, details.refs),
    pushTags: () => void pushTags(repoRoot),
    showLog: () => void showLog(repoRoot),
  };
}

/** The "..." menu of a repository row, with stash, tag and remote counts read first. */
export async function repoMenuFor(repoRoot: string): Promise<MenuItem[]> {
  const details = await loadDetails(repoRoot);
  const section = currentSection(repoRoot);
  if (!section) {
    return [];
  }
  return withRepoExtras(repoMenuItems(stateOf(section, extrasOf(details)), handlersFor(repoRoot, details)), repoRoot);
}

/** The branch button and Git > Branches...: JetBrains' Branches popup. */
export function openBranchPicker(repoRoot: string): void {
  gitDialogs.open({ kind: "branches", repoRoot });
}
