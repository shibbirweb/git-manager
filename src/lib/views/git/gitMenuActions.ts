// What the Git menu's items do, JetBrains style. Each acts on the active repository (or the
// current file's repository for the Current File submenu) and reuses the actions of the
// Changes view, the sidebar and the Log, so a menu item and its button run the same code.

import { EditorView } from "@codemirror/view";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api, errorMessage } from "$lib/api";
import { logSelection } from "$lib/log/logSelection.svelte";
import { gitTabPath, type GitTabRef } from "$lib/stores/gitTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { CommitSummary, OpOutcome, PatchSource, StashEntry } from "$lib/types";
import { dialogs, type PickItem } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { updates } from "$lib/update/updates.svelte";
import { changesSelection } from "../changes/selection.svelte";
import { commitOptions } from "../changes/commitOptions.svelte";
import { ensureIdentity } from "../changes/identityCheck";
import { pickedStash, refPickItems, decodeRefPick, stashPickItems } from "../changes/repoPickers";
import { createTag, mergeBranch, openBranchPicker, rebaseBranch } from "../changes/repoActions";
import { applyStash, newBranchFrom, repoTarget } from "../sidebar/actions";
import { gitDialogs } from "./gitDialogs.svelte";
import { currentGitFile, fileStatusOf } from "./gitMenuInputs";
import { rollbackPaths, updatePlan, updateProgressText } from "./gitOptions";
import { headLineRange } from "./lineHistoryRange";
import { gitHubCompareUrl, gitHubFileUrl, gitHubPullsUrl, type LineRange, linkRevision, pickGitHubRemote } from "./github";
import { remoteLinkPickItems, remoteLinks } from "./remoteLinks";

/** How many recent commits the commit pickers list. */
const PICKER_COMMITS = 200;

function activeRoot(): string | null {
  return repoStore.repo?.root ?? null;
}

function repoName(repoRoot: string): string {
  return repoStore.repos.find((repo) => repo.root === repoRoot)?.name ?? "repository";
}

function target(repoRoot: string) {
  return repoTarget(repoRoot, repoStore.refs);
}

/** The file editor on screen, as a repository file. */
function currentFile() {
  const activePath = changesSelection.shownView === "file" ? repoStore.openFilePath : null;
  return currentGitFile(activePath);
}

/** The CodeMirror view of the editor tab on screen. */
function activeEditorView(): EditorView | null {
  const element = document.querySelector<HTMLElement>(".file-host:not(.hidden) .cm-editor");
  return element ? EditorView.findFromDOM(element) : null;
}

/** The lines the editor's selection covers (1-based), or the caret line; a selection ending at a line start leaves that line out. */
function selectedLines(): LineRange | null {
  const view = activeEditorView();
  if (!view) {
    return null;
  }
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const start = doc.lineAt(from).number;
  let end = doc.lineAt(to).number;
  if (to > from && end > start && doc.line(end).from === to) {
    end--;
  }
  return { start, end };
}

// Commit pickers

function commitItem(commit: CommitSummary): PickItem {
  const refs = (commit.refs ?? []).map((ref) => ref.name).join(", ");
  return {
    value: commit.id,
    label: commit.summary || commit.shortId,
    description: [commit.shortId, commit.authorName, refs].filter((part) => part !== "").join("  "),
  };
}

/** A commit from recent history; `allRefs` lists every branch, like the Log's All branches. */
async function pickCommit(repoRoot: string, title: string, allRefs: boolean): Promise<CommitSummary | null> {
  let commits: CommitSummary[];
  try {
    commits = await api.getLog(repoRoot, 0, PICKER_COMMITS, allRefs);
  } catch (error) {
    toast.error("Could not read the history", errorMessage(error));
    return null;
  }
  const commitId = await dialogs.pick({
    title: `${title} (${repoName(repoRoot)})`,
    placeholder: "Filter by message, author or hash",
    items: commits.map(commitItem),
    emptyText: "No commits",
  });
  return commits.find((commit) => commit.id === commitId) ?? null;
}

// Push, pull, update, fetch

export function openPushDialog(): void {
  const repoRoot = activeRoot();
  if (repoRoot) {
    gitDialogs.open({ kind: "push", repoRoot });
  }
}

export function openPullDialog(): void {
  const repoRoot = activeRoot();
  if (repoRoot) {
    gitDialogs.open({ kind: "pull", repoRoot });
  }
}

/**
 * Update Project: pulls every repository of the workspace one after another with the
 * remembered method, showing "Updating 2 of 5"; stops at the first conflict or failure.
 */
export async function updateProject(): Promise<void> {
  const plan = updatePlan(repoStore.repos, repoStore.statuses);
  const mode = settings.updateMethod === "rebase" ? "rebase" : "merge";
  let updated = 0;
  for (const [index, step] of plan.steps.entries()) {
    const label = updateProgressText(index, plan.steps.length, step.name);
    const outcome = await repoStore.runOp(label, (repoPath) => api.pullWithOptions(repoPath, null, null, mode, false), undefined, step.repoRoot);
    if (!outcome || outcome.conflicts) {
      const left = plan.steps.length - index - 1;
      if (left > 0) {
        toast.info(`Update stopped at ${step.name}`, `${left} ${left === 1 ? "repository was" : "repositories were"} not updated.`);
      }
      return;
    }
    updated++;
  }
  const skipped = plan.skipped.map((entry) => `${entry.name}: ${entry.reason}`).join("\n");
  if (updated === 0) {
    toast.info("Nothing to update", skipped || undefined);
    return;
  }
  toast.success(updated === 1 ? "Updated 1 repository" : `Updated ${updated} repositories`, skipped ? `Skipped\n${skipped}` : undefined);
}

// Branches, tags, reset, cherry-pick

export function mergeFromMenu(): void {
  const repoRoot = activeRoot();
  if (repoRoot) {
    mergeBranch(repoRoot);
  }
}

export function rebaseFromMenu(): void {
  const repoRoot = activeRoot();
  if (repoRoot) {
    rebaseBranch(repoRoot);
  }
}

export function branchesFromMenu(): void {
  const repoRoot = activeRoot();
  if (repoRoot) {
    openBranchPicker(repoRoot);
  }
}

export function newBranchFromMenu(): Promise<void> | undefined {
  const repoRoot = activeRoot();
  return repoRoot ? newBranchFrom(null, "", target(repoRoot)) : undefined;
}

export function newTagFromMenu(): Promise<void> | undefined {
  const repoRoot = activeRoot();
  return repoRoot ? createTag(repoRoot, repoStore.refs) : undefined;
}

export function openResetDialog(): void {
  const repoRoot = activeRoot();
  if (repoRoot) {
    gitDialogs.open({ kind: "reset", repoRoot });
  }
}

export async function cherryPickFromMenu(): Promise<void> {
  const repoRoot = activeRoot();
  if (!repoRoot) {
    return;
  }
  const commit = await pickCommit(repoRoot, "Cherry-Pick", true);
  if (!commit) {
    return;
  }
  if (commit.parents.length > 1) {
    toast.info("Merge commits cannot be cherry-picked here");
    return;
  }
  await repoStore.runOp("Cherry-pick", (repoPath) => api.cherryPick(repoPath, commit.id), `Cherry-picked ${commit.shortId}`, repoRoot);
}

// Interactive rebase

/** Opens the Interactive Rebase dialog for the commits from `fromCommit` (included) to HEAD. */
export async function startInteractiveRebase(repoRoot: string, fromCommit: string): Promise<void> {
  if ((repoStore.statuses[repoRoot]?.op.kind ?? "none") !== "none") {
    toast.info("Finish or abort the operation in progress first");
    return;
  }
  try {
    const plan = await api.rebasePlan(repoRoot, fromCommit);
    if (plan.commits.length === 0) {
      toast.info("There are no commits to rebase");
      return;
    }
    gitDialogs.open({ kind: "rebase", repoRoot, plan });
  } catch (error) {
    toast.error("Could not start the interactive rebase", errorMessage(error));
  }
}

/** Git > Interactive Rebase...: asks for the oldest commit to rewrite. */
export async function interactiveRebaseFromMenu(): Promise<void> {
  const repoRoot = activeRoot();
  if (!repoRoot) {
    return;
  }
  const commit = await pickCommit(repoRoot, "Interactive Rebase from...", false);
  if (commit) {
    await startInteractiveRebase(repoRoot, commit.id);
  }
}

// Patches

const PATCH_FILTERS = [{ name: "Patch", extensions: ["patch", "diff"] }];

function patchFileName(text: string): string {
  const cleaned = text
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${cleaned || "changes"}.patch`;
}

async function savePatchAs(defaultName: string): Promise<string | null> {
  const chosen = await save({ title: "Save Patch", defaultPath: defaultName, filters: PATCH_FILTERS });
  if (typeof chosen !== "string" || !chosen) {
    return null;
  }
  return /\.(patch|diff)$/i.test(chosen) ? chosen : `${chosen}.patch`;
}

/** Create Patch: staged, unstaged or all uncommitted changes, saved where the user picks. */
export async function createPatchFromChanges(): Promise<void> {
  const repoRoot = activeRoot();
  if (!repoRoot) {
    return;
  }
  const files = repoStore.statuses[repoRoot]?.files ?? [];
  const staged = files.filter((file) => file.staged !== null).length;
  const unstaged = files.filter((file) => file.unstaged !== null && file.unstaged !== "untracked").length;
  const source = await dialogs.choose<PatchSource>({
    title: "Create Patch",
    message: "Untracked files are not included; stage them first to put them in the patch.",
    options: [
      { value: "all", label: "All changes", description: "Staged and unstaged changes against HEAD" },
      { value: "staged", label: "Staged changes", description: staged === 1 ? "1 file" : `${staged} files` },
      { value: "unstaged", label: "Unstaged changes", description: unstaged === 1 ? "1 file" : `${unstaged} files` },
    ],
  });
  if (!source) {
    return;
  }
  const patchPath = await savePatchAs(patchFileName(`${repoName(repoRoot)}-${source}`));
  if (!patchPath) {
    return;
  }
  await repoStore.run("Create patch", (repoPath) => api.createPatch(repoPath, source, [], patchPath), {
    repoPath: repoRoot,
    refresh: false,
    success: (count) => `Saved a patch of ${count === 1 ? "1 file" : `${count} files`}`,
  });
}

/** Create Patch from Commit: the Log's selected commit, else one picked from the history. */
export async function createPatchFromCommit(): Promise<void> {
  const repoRoot = activeRoot();
  if (!repoRoot) {
    return;
  }
  const selected = logSelection.current;
  const shownLog = changesSelection.logShown && selected?.repoRoot === repoRoot;
  const commit = shownLog && selected ? selected : await pickCommit(repoRoot, "Create Patch from Commit", true);
  if (!commit) {
    return;
  }
  const commitId = "commitId" in commit ? commit.commitId : commit.id;
  const patchPath = await savePatchAs(patchFileName(`${commit.shortId}-${commit.summary}`));
  if (!patchPath) {
    return;
  }
  await repoStore.run("Create patch", (repoPath) => api.createCommitPatch(repoPath, commitId, patchPath), {
    repoPath: repoRoot,
    refresh: false,
    success: `Saved ${commit.shortId} as a patch`,
  });
}

function applyMessage(outcome: OpOutcome): string | null {
  return outcome.conflicts ? null : "Patch applied";
}

async function applyPatchWith(patchPath: string | null, patchText: string | null): Promise<void> {
  const repoRoot = activeRoot();
  if (!repoRoot) {
    return;
  }
  const outcome = await repoStore.run("Apply patch", (repoPath) => api.applyPatch(repoPath, patchPath, patchText), {
    repoPath: repoRoot,
    success: applyMessage,
  });
  if (outcome?.conflicts) {
    toast.info("The patch was applied with a 3-way merge and has conflicts", "Resolve them in the Changes view.");
    repoStore.conflictsOpen = true;
  }
}

export async function applyPatchFromFile(): Promise<void> {
  const chosen = await open({ title: "Apply Patch", multiple: false, directory: false, filters: PATCH_FILTERS });
  if (typeof chosen === "string" && chosen) {
    await applyPatchWith(chosen, null);
  }
}

export async function applyPatchFromClipboard(): Promise<void> {
  let text: string;
  try {
    text = await api.readClipboardText();
  } catch (error) {
    toast.error("Could not read the clipboard", errorMessage(error));
    return;
  }
  if (!/^(diff --git |--- |From [0-9a-f]{40} )/m.test(text)) {
    toast.info("The clipboard holds no patch");
    return;
  }
  await applyPatchWith(null, text);
}

// Uncommitted changes

export async function unstashFromMenu(): Promise<void> {
  const repoRoot = activeRoot();
  if (!repoRoot) {
    return;
  }
  const stashes: StashEntry[] = repoStore.stashes.length > 0 ? repoStore.stashes : await api.getStashes(repoRoot).catch(() => []);
  if (stashes.length === 0) {
    toast.info("There are no stashes");
    return;
  }
  const value = await dialogs.pick({
    title: `Unstash Changes (${repoName(repoRoot)})`,
    placeholder: "Select a stash",
    items: stashPickItems(stashes),
    emptyText: "No stashes",
  });
  const stash = pickedStash(stashes, value);
  if (!stash) {
    return;
  }
  const how = await dialogs.choose<"apply" | "pop">({
    title: `Unstash stash@{${stash.index}}`,
    message: stash.message,
    options: [
      { value: "pop", label: "Pop", description: "Apply the changes and drop the stash" },
      { value: "apply", label: "Apply", description: "Apply the changes and keep the stash" },
    ],
  });
  if (how) {
    await applyStash(stash.index, how === "pop", repoRoot);
  }
}

export function openRollbackDialog(filePaths: string[] | null = null, repoRoot: string | null = activeRoot()): void {
  if (repoRoot) {
    gitDialogs.open({ kind: "rollback", repoRoot, filePaths });
  }
}

/** Git > Show Reflog: one tab per repository, HEAD first; branches are picked inside it. */
export function showReflog(): void {
  const repoRoot = activeRoot();
  if (repoRoot) {
    openGitTab({ kind: "reflog", repoRoot });
  }
}

export function showLocalChanges(): void {
  settings.setLeftPanel("changes");
}

// Current file

function openGitTab(ref: GitTabRef): void {
  repoStore.openPseudoTab(gitTabPath(ref));
}

export async function commitCurrentFile(): Promise<void> {
  const file = currentFile();
  if (!file) {
    return;
  }
  const name = file.filePath.slice(file.filePath.lastIndexOf("/") + 1);
  const result = await dialogs.prompt({
    title: `Commit ${name}`,
    label: "Commit message",
    placeholder: "Summary",
    confirmLabel: "Commit",
    secondary: { label: "Description (optional)", placeholder: "More details" },
  });
  if (!result) {
    return;
  }
  const message = result.secondary ? `${result.value}\n\n${result.secondary}` : result.value;
  const options = commitOptions.request(file.repoRoot);
  if (!options) {
    return;
  }
  if (!(await ensureIdentity(file.repoRoot))) {
    return;
  }
  settings.rememberCommitMessage(file.repoRoot, message);
  await repoStore.run("Commit", (repoPath) => api.commitFiles(repoPath, [file.filePath], message, false, options), {
    repoPath: file.repoRoot,
    success: `Committed ${name}`,
  });
}

export async function addCurrentFile(): Promise<void> {
  const file = currentFile();
  if (file) {
    await repoStore.run("Add to Git", (repoPath) => api.stageFiles(repoPath, [file.filePath]), {
      repoPath: file.repoRoot,
      success: `Added ${file.filePath}`,
    });
  }
}

export function toggleAnnotate(): void {
  settings.setPreference("blameGutter", !settings.blameGutter);
}

export function showCurrentFileDiff(): void {
  const file = currentFile();
  const status = file ? fileStatusOf(file.repoRoot, file.filePath) : null;
  if (!file || !status) {
    toast.info("The file has no changes");
    return;
  }
  const area = status.unstaged !== null || status.conflicted ? "unstaged" : "staged";
  changesSelection.pick({ repoRoot: file.repoRoot, path: file.filePath, area });
}

export async function compareCurrentFileWithRevision(): Promise<void> {
  const file = currentFile();
  if (!file) {
    return;
  }
  let entries;
  try {
    entries = await api.fileHistory(file.repoRoot, file.filePath, 0, PICKER_COMMITS);
  } catch (error) {
    toast.error("Could not read the file's history", errorMessage(error));
    return;
  }
  const commitId = await dialogs.pick({
    title: `Compare ${file.filePath} with Revision`,
    placeholder: "Filter by message, author or hash",
    items: entries.map((entry) => ({
      ...commitItem(entry.commit),
      description: [entry.commit.shortId, entry.commit.authorName, entry.path !== file.filePath ? entry.path : ""]
        .filter((part) => part !== "")
        .join("  "),
    })),
    emptyText: "No commits touch this file",
  });
  if (commitId) {
    openGitTab({ kind: "compare", repoRoot: file.repoRoot, filePath: file.filePath, revision: commitId });
  }
}

export async function compareCurrentFileWithBranch(): Promise<void> {
  const file = currentFile();
  if (!file) {
    return;
  }
  const refs = file.repoRoot === repoStore.repo?.root ? repoStore.refs : await api.getRefs(file.repoRoot).catch(() => null);
  const picked = decodeRefPick(
    await dialogs.pick({
      title: `Compare ${file.filePath} with Branch`,
      placeholder: "Select a branch or tag",
      items: refPickItems(refs, { local: true, remote: true, tags: true, skipCurrent: true }),
      emptyText: "No other branches",
    }),
  );
  if (picked && picked.kind !== "create" && picked.kind !== "createFrom") {
    openGitTab({ kind: "compare", repoRoot: file.repoRoot, filePath: file.filePath, revision: picked.name });
  }
}

export function showCurrentFileHistory(): void {
  const file = currentFile();
  if (file) {
    openGitTab({ kind: "fileHistory", repoRoot: file.repoRoot, filePath: file.filePath });
  }
}

/**
 * The selected lines as numbered in HEAD, which `git log -L` reads, so uncommitted lines above
 * the selection do not shift it. Null when every selected line is new. When the committed text
 * cannot be read, the editor's numbers are kept and git reports any problem.
 */
async function committedSelection(repoRoot: string, filePath: string, lines: LineRange): Promise<LineRange | null> {
  const view = activeEditorView();
  if (!view) {
    return lines;
  }
  const origPath = fileStatusOf(repoRoot, filePath)?.origPath ?? null;
  try {
    const committed = await api.readHeadFile(repoRoot, filePath, origPath);
    if (committed.binary || committed.tooLarge) {
      return lines;
    }
    return headLineRange(committed.content.split("\n"), view.state.doc.toJSON(), lines);
  } catch {
    return lines;
  }
}

export async function showSelectionHistory(): Promise<void> {
  const file = currentFile();
  const lines = selectedLines();
  if (!file || !lines) {
    return;
  }
  const committed = await committedSelection(file.repoRoot, file.filePath, lines);
  if (!committed) {
    toast.info("No history for these lines", "They are not committed yet. Select lines that are in the last commit.");
    return;
  }
  openGitTab({ kind: "lineHistory", repoRoot: file.repoRoot, filePath: file.filePath, startLine: committed.start, endLine: committed.end });
}

export async function rollbackCurrentFile(): Promise<void> {
  const file = currentFile();
  const status = file ? fileStatusOf(file.repoRoot, file.filePath) : null;
  if (!file || !status) {
    return;
  }
  const added = status.staged === "added";
  const confirmed = await dialogs.confirm({
    title: "Rollback File",
    message: added
      ? `${file.filePath} is new: it will be removed from Git and stay on disk as an untracked file.`
      : `Staged and unstaged changes to ${file.filePath} will be lost. This cannot be undone.`,
    confirmLabel: "Rollback",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Rollback", (repoPath) => api.rollbackFiles(repoPath, rollbackPaths([status]), false), {
    repoPath: file.repoRoot,
    success: `Rolled back ${file.filePath}`,
  });
}

// Remotes and clone

export function openRemotesDialog(): void {
  const repoRoot = activeRoot();
  if (repoRoot) {
    gitDialogs.open({ kind: "remotes", repoRoot });
  }
}

/** The remote's web page; with several, a list to choose from (the upstream's remote first). */
export async function openRemoteInBrowser(): Promise<void> {
  const upstream = repoStore.status?.head.upstream ?? null;
  const links = remoteLinks(repoStore.remotes, upstream?.split("/")[0] ?? null);
  if (links.length === 0) {
    toast.info("No remote with a web page", "Add a remote such as https://github.com/owner/repo in Manage Remotes.");
    return;
  }
  const url =
    links.length === 1
      ? links[0].url
      : await dialogs.pick({
          title: "Open Repository in Browser",
          placeholder: "Type to filter remotes",
          items: remoteLinkPickItems(links),
        });
  if (url) {
    await updates.open(url);
  }
}

export function openCloneDialog(): void {
  gitDialogs.open({ kind: "clone" });
}

// GitHub

function gitHubRemote() {
  const upstream = repoStore.status?.head.upstream ?? null;
  return pickGitHubRemote(repoStore.remotes, upstream?.split("/")[0] ?? null);
}

/** The page of the current file (and its selected lines), or of the repository. */
async function gitHubLink(withFile: boolean): Promise<string | null> {
  const repoRoot = activeRoot();
  const remote = gitHubRemote();
  if (!repoRoot || !remote) {
    return null;
  }
  const file = withFile ? currentFile() : null;
  const sameRepo = file === null || file.repoRoot === repoRoot;
  const headCommit = await api
    .getLog(repoRoot, 0, 1, false)
    .then((commits) => commits[0]?.id ?? null)
    .catch(() => null);
  const revision = linkRevision(repoStore.status?.head ?? null, remote.remoteName, headCommit);
  if (!sameRepo || !file) {
    return gitHubFileUrl(remote, revision, null);
  }
  return gitHubFileUrl(remote, revision, file.filePath, selectedLines());
}

export async function openOnGitHub(): Promise<void> {
  const url = await gitHubLink(true);
  if (url) {
    await updates.open(url);
  }
}

export async function copyGitHubLink(): Promise<void> {
  const url = await gitHubLink(true);
  if (!url) {
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Copied GitHub link", url);
  } catch (error) {
    toast.error("Could not copy", errorMessage(error));
  }
}

export async function createPullRequest(): Promise<void> {
  const remote = gitHubRemote();
  const branch = repoStore.status?.head.branch ?? null;
  if (!remote || !branch) {
    return;
  }
  if (!repoStore.status?.head.upstream) {
    toast.info(`Push ${branch} first`, "GitHub needs the branch to open a pull request.");
  }
  await updates.open(gitHubCompareUrl(remote, remote.defaultBranch, branch));
}

export async function viewPullRequests(): Promise<void> {
  const remote = gitHubRemote();
  if (remote) {
    await updates.open(gitHubPullsUrl(remote));
  }
}
