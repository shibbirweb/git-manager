<!-- Share Project on GitHub: creates the repository on GitHub (private by
     default), adds it as a remote and pushes the current branch with upstream. A repository
     without commits gets an initial commit of every file first. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { GitHubSharedRepository } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import GitDialogFrame from "../git/GitDialogFrame.svelte";
  import { githubAccount } from "./githubAccount.svelte";
  import { closeGitHubDialog, openGitHubDialog } from "./githubDialogs";
  import { defaultShareRemoteName, suggestRepositoryName, validateRepositoryName, validateShareRemoteName } from "./githubModel";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  function folderName(): string {
    const known = repoStore.repos.find((repo) => repo.root === repoRoot)?.name ?? null;
    return known ?? repoRoot.slice(repoRoot.replace(/\/+$/, "").lastIndexOf("/") + 1);
  }

  let repositoryName = $state(suggestRepositoryName(folderName()));
  let isPrivate = $state(true);
  let description = $state("");
  let remoteName = $state("origin");
  let remoteEdited = $state(false);
  let remoteNames = $state.raw<string[]>([]);
  let commitMessage = $state("Initial commit");
  let working = $state(false);
  let step = $state("");
  let problem = $state<string | null>(null);

  const status = $derived(repoStore.statuses[repoRoot] ?? null);
  const unborn = $derived(status?.head.unborn ?? false);
  const branchName = $derived(status?.head.branch ?? null);
  const fileCount = $derived(status?.files.length ?? 0);
  const login = $derived(githubAccount.account?.login ?? null);

  const nameError = $derived(validateRepositoryName(repositoryName));
  const remoteError = $derived(validateShareRemoteName(remoteName, remoteNames));
  const blocker = $derived.by(() => {
    if (status && branchName === null) {
      return "HEAD is detached: check out a branch to share first.";
    }
    if (unborn && fileCount === 0) {
      return "This repository has no commits and no files to commit yet.";
    }
    return null;
  });
  const commitError = $derived(unborn && commitMessage.trim() === "" ? "Enter a commit message" : null);
  const canShare = $derived(!working && nameError === null && remoteError === null && blocker === null && commitError === null);

  onMount(() => {
    void api
      .listRemotes(repoRoot)
      .then((remotes) => {
        remoteNames = remotes.map((remote) => remote.name);
        if (!remoteEdited) {
          remoteName = defaultShareRemoteName(remoteNames);
        }
      })
      .catch(() => undefined);
  });

  function close(): void {
    if (!working) {
      closeGitHubDialog();
    }
  }

  async function submit(): Promise<void> {
    if (!canShare) {
      return;
    }
    if (!isPrivate) {
      const confirmed = await dialogs.confirm({
        title: "Share as Public",
        message: `Anyone on the internet can see ${repositoryName.trim()} and its history. Share it as public?`,
        confirmLabel: "Share Public",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    working = true;
    problem = null;
    step = unborn ? "Committing the files and creating the repository..." : "Creating the repository on GitHub...";
    // Assigned inside the callback below, so TypeScript must not narrow it to null here.
    let shared = null as GitHubSharedRepository | null;
    // Errors stay in this dialog, so the user can fix the name and try again.
    await repoStore.run(
      "Share on GitHub",
      async (repoPath) => {
        try {
          shared = await api.githubShareProject(repoPath, {
            repositoryName: repositoryName.trim(),
            private: isPrivate,
            description: description.trim(),
            remoteName: remoteName.trim(),
            initialCommitMessage: unborn ? commitMessage.trim() : null,
          });
        } catch (error) {
          problem = errorMessage(error);
        }
      },
      { repoPath: repoRoot },
    );
    if (!shared) {
      working = false;
      step = "";
      return;
    }
    await push(shared);
  }

  async function push(shared: GitHubSharedRepository): Promise<void> {
    step = `Pushing ${shared.branchName} to ${shared.remoteName}...`;
    let pushProblem = null as string | null;
    await repoStore.run(
      `Push ${shared.branchName}`,
      async (repoPath) => {
        try {
          await api.pushWithOptions(repoPath, shared.remoteName, shared.branchName, false, false);
        } catch (error) {
          pushProblem = errorMessage(error);
        }
      },
      { repoPath: repoRoot },
    );
    working = false;
    openGitHubDialog({
      kind: "result",
      title: pushProblem ? "Created on GitHub, Not Pushed" : "Shared on GitHub",
      message: pushProblem
        ? `${shared.fullName} was created and added as ${shared.remoteName}, but pushing ${shared.branchName} failed. Make sure git can sign in to github.com over HTTPS (for example run gh auth setup-git), then push again.`
        : `${shared.fullName} was created and ${shared.branchName} was pushed to ${shared.remoteName}, tracking it.`,
      url: shared.htmlUrl,
      openLabel: "Open on GitHub",
      problem: pushProblem,
    });
  }
</script>

<GitDialogFrame title="Share Project on GitHub" width={540} closable={!working} onCancel={close} onSubmit={() => void submit()}>
  {#if login}
    <div class="hint">Creates the repository under <strong>{login}</strong> on github.com.</div>
  {/if}
  <label class="field">
    <span>Repository name</span>
    <input class="input" bind:value={repositoryName} disabled={working} spellcheck="false" autocomplete="off" data-autofocus />
  </label>
  {#if nameError}
    <div class="error">{nameError}</div>
  {/if}
  <label class="check">
    <input type="checkbox" bind:checked={isPrivate} disabled={working} />
    Private
  </label>
  <div class="row two">
    <label class="field grow">
      <span>Remote</span>
      <input
        class="input"
        bind:value={remoteName}
        oninput={() => (remoteEdited = true)}
        disabled={working}
        spellcheck="false"
        autocomplete="off"
      />
    </label>
    <label class="field wide">
      <span>Description</span>
      <input class="input" bind:value={description} disabled={working} placeholder="Optional" autocomplete="off" />
    </label>
  </div>
  {#if remoteError}
    <div class="error">{remoteError}</div>
  {/if}
  {#if unborn && fileCount > 0}
    <div class="hint">
      This repository has no commits yet. Every file that is not ignored is committed first, then pushed.
    </div>
    <label class="field">
      <span>Initial commit message</span>
      <input class="input" bind:value={commitMessage} disabled={working} autocomplete="off" />
    </label>
    {#if commitError}
      <div class="error">{commitError}</div>
    {/if}
  {:else if branchName && !blocker}
    <div class="hint">
      Pushes {branchName} with upstream.{fileCount > 0 ? " Uncommitted changes stay local." : ""}
    </div>
  {/if}
  {#if blocker}
    <div class="error">{blocker}</div>
  {/if}
  {#if working}
    <div class="progress row" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <span class="truncate">{repoStore.progress || step}</span>
    </div>
  {/if}
  {#if problem}
    <div class="error selectable">{problem}</div>
  {/if}

  {#snippet footer()}
    <button type="button" class="btn" onclick={close} disabled={working}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canShare} onclick={() => void submit()}>
      {working ? "Sharing..." : "Share"}
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .two {
    align-items: flex-start;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .wide {
    flex: 2;
    min-width: 0;
  }

  .progress {
    font-size: 12px;
    color: var(--text-dim);
    min-width: 0;
  }
</style>
