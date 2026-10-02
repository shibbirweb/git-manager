// What the Git > GitHub items that need an account do: Share Project on GitHub, Sync Fork
// and Create Gist. Each asks to sign in first when no account is set up.

import { EditorView } from "@codemirror/view";
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { changesSelection } from "../changes/selection.svelte";
import { pickGitHubRemote } from "../git/github";
import { githubAccount } from "./githubAccount.svelte";
import { openGitHubDialog } from "./githubDialogs";
import { forkCompareUrl, gistFileName, syncForkBranch, syncForkTitle } from "./githubModel";

/** True when signed in; otherwise opens the sign-in dialog, which runs `retry` once signed in. */
async function requireAccount(actionLabel: string, retry: () => void): Promise<boolean> {
  if (await githubAccount.load()) {
    return true;
  }
  openGitHubDialog({ kind: "signIn", actionLabel, onSignedIn: retry });
  return false;
}

function gitHubRemote() {
  const upstream = repoStore.status?.head.upstream ?? null;
  return pickGitHubRemote(repoStore.remotes, upstream?.split("/")[0] ?? null);
}

export async function shareProjectOnGitHub(): Promise<void> {
  const repoRoot = repoStore.repo?.root ?? null;
  if (!repoRoot) {
    return;
  }
  const existing = gitHubRemote();
  if (existing) {
    toast.info("Already on GitHub", `${existing.remoteName} points to ${existing.owner}/${existing.repo}.`);
    return;
  }
  if (!(await requireAccount("Share Project on GitHub", () => void shareProjectOnGitHub()))) {
    return;
  }
  openGitHubDialog({ kind: "share", repoRoot });
}

export async function syncFork(): Promise<void> {
  const repoRoot = repoStore.repo?.root ?? null;
  const remote = gitHubRemote();
  if (!repoRoot || !remote) {
    return;
  }
  if (!(await requireAccount("Sync Fork", () => void syncFork()))) {
    return;
  }
  let info;
  try {
    info = await api.githubRepository(remote.owner, remote.repo);
  } catch (error) {
    toast.error("Sync Fork failed", errorMessage(error));
    return;
  }
  const parent = info.parent ?? null;
  if (!info.fork || !parent) {
    toast.info("Not a fork", `${info.fullName} was not forked from another repository.`);
    return;
  }
  const branchName = syncForkBranch(repoStore.status?.head ?? null, remote.remoteName, info.defaultBranch);
  if (!branchName) {
    toast.info("Nothing to sync", "Check out a branch first.");
    return;
  }
  const confirmed = await dialogs.confirm({
    title: "Sync Fork",
    message: `Update ${branchName} of ${info.fullName} on GitHub with the changes in ${parent.fullName}, then fetch?`,
    confirmLabel: "Sync Fork",
  });
  if (!confirmed) {
    return;
  }
  const outcome = await repoStore.run("Sync Fork", () => api.githubSyncFork(remote.owner, remote.repo, branchName), {
    repoPath: repoRoot,
    refresh: false,
  });
  if (!outcome) {
    return;
  }
  if (outcome.kind === "conflict") {
    const parentBranch = branchName === info.defaultBranch ? parent.defaultBranch : branchName;
    openGitHubDialog({
      kind: "result",
      title: syncForkTitle(outcome),
      message: `GitHub cannot sync ${branchName} because it conflicts with ${parent.fullName}. Open a pull request to merge the changes and resolve the conflicts there.`,
      url: forkCompareUrl(remote, parent, branchName, parentBranch),
      openLabel: "Open Pull Request",
      problem: outcome.message,
    });
    return;
  }
  // Brings the synced branch into the remote-tracking refs; pulling stays the user's choice.
  const fetched = await repoStore.runOp("Fetch", (repoPath) => api.fetchAll(repoPath), undefined, repoRoot);
  const next = fetched
    ? `Fetched ${remote.remoteName}: pull to update your local ${branchName}.`
    : "Fetch the remote to see the changes locally.";
  openGitHubDialog({
    kind: "result",
    title: syncForkTitle(outcome),
    message: `${outcome.message} ${next}`,
    url: `${info.htmlUrl}/tree/${branchName.split("/").map(encodeURIComponent).join("/")}`,
    openLabel: "Open on GitHub",
    problem: null,
  });
}

/** The CodeMirror view of the file editor on screen. */
function activeEditorView(): EditorView | null {
  const element = document.querySelector<HTMLElement>(".file-host:not(.hidden) .cm-editor");
  return element ? EditorView.findFromDOM(element) : null;
}

export async function createGist(): Promise<void> {
  const filePath = changesSelection.shownView === "file" ? repoStore.openFilePath : null;
  const view = filePath ? activeEditorView() : null;
  if (!filePath || !view) {
    toast.info("Open a file first", "Create Gist shares the file on screen or its selection.");
    return;
  }
  const { from, to } = view.state.selection.main;
  const fromSelection = to > from;
  const content = fromSelection ? view.state.sliceDoc(from, to) : view.state.doc.toString();
  if (!(await requireAccount("Create Gist", () => void createGist()))) {
    return;
  }
  openGitHubDialog({ kind: "gist", fileName: gistFileName(filePath), content, fromSelection });
}
