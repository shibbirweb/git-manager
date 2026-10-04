<!-- The Push dialog: the commits the current branch would push, the target remote and
     branch, Force push (--force-with-lease) and Push tags. A branch without an upstream gets one. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { OutgoingCommits } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { defaultPushTarget, isValidRefName, pushCommand } from "./gitOptions";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  const status = $derived(repoStore.statuses[repoRoot] ?? null);
  const head = $derived(status?.head ?? null);
  const localBranch = $derived(head?.branch ?? null);
  const remoteNames = $derived(remoteNamesOf(repoRoot));
  const initialTarget = untrack(() => defaultPushTarget(repoStore.statuses[repoRoot]?.head, remoteNamesOf(repoRoot)));

  let remoteName = $state(initialTarget?.remoteName ?? "");
  let remoteBranch = $state(initialTarget?.remoteBranch ?? "");
  let forceWithLease = $state(false);
  let pushTags = $state(false);
  let outgoing = $state.raw<OutgoingCommits | null>(null);
  let loadError = $state<string | null>(null);
  let loading = $state(false);
  let loadToken = 0;
  const now = Date.now();

  function remoteNamesOf(targetRoot: string): string[] {
    return targetRoot === repoStore.repo?.root && repoStore.refs ? repoStore.refs.remotes : repoStore.remotes.map((remote) => remote.name);
  }

  const setUpstream = $derived(!head?.upstream);
  const branchError = $derived(
    remoteBranch.trim() === "" ? "Enter the remote branch" : isValidRefName(remoteBranch.trim()) ? null : "Not a valid branch name",
  );
  const canPush = $derived(localBranch !== null && remoteName !== "" && branchError === null && repoStore.busy === null);
  const command = $derived(
    localBranch
      ? pushCommand({ localBranch, remoteName: remoteName || "origin", remoteBranch: remoteBranch.trim(), forceWithLease, pushTags, setUpstream })
      : "",
  );

  // The outgoing commits follow the target, after a short pause while typing.
  $effect(() => {
    const targetRemote = remoteName;
    const targetBranch = remoteBranch.trim();
    if (!targetRemote || !targetBranch) {
      outgoing = null;
      return;
    }
    const timer = setTimeout(() => void loadOutgoing(targetRemote, targetBranch), 200);
    return () => clearTimeout(timer);
  });

  async function loadOutgoing(targetRemote: string, targetBranch: string): Promise<void> {
    const token = ++loadToken;
    loading = true;
    try {
      const result = await api.outgoingCommits(repoRoot, targetRemote, targetBranch);
      if (token === loadToken) {
        outgoing = result;
        loadError = null;
      }
    } catch (error) {
      if (token === loadToken) {
        outgoing = null;
        loadError = errorMessage(error);
      }
    } finally {
      if (token === loadToken) {
        loading = false;
      }
    }
  }

  function close(): void {
    gitDialogs.close();
  }

  async function submit(): Promise<void> {
    const branch = localBranch;
    const targetBranch = remoteBranch.trim();
    if (!canPush || !branch) {
      return;
    }
    if (forceWithLease) {
      const confirmed = await dialogs.confirm({
        title: "Force Push",
        message: `Force push ${branch} to ${remoteName}/${targetBranch} with --force-with-lease? Commits on the remote that you do not have will be lost.`,
        confirmLabel: "Force Push",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    const force = forceWithLease;
    const tags = pushTags;
    const targetRemote = remoteName;
    close();
    await repoStore.runOp(
      "Push",
      (repoPath) => api.pushWithOptions(repoPath, targetRemote, targetBranch, force, tags),
      force ? `Force pushed ${branch}` : `Pushed ${branch} to ${targetRemote}/${targetBranch}`,
      repoRoot,
    );
  }
</script>

<GitDialogFrame title="Push Commits" width={620} onCancel={close} onSubmit={() => void submit()}>
  {#if !localBranch}
    <p class="error">HEAD is detached: check out a branch to push it.</p>
  {:else if remoteNames.length === 0}
    <p class="error">This repository has no remote. Add one with Git > Manage Remotes.</p>
  {:else}
    <div class="target row">
      <span class="mono local">{localBranch}</span>
      <span class="dim">&rarr;</span>
      <select class="input" bind:value={remoteName} aria-label="Remote">
        {#each remoteNames as name (name)}
          <option value={name}>{name}</option>
        {/each}
      </select>
      <span class="dim">:</span>
      <input class="input mono branch" bind:value={remoteBranch} aria-label="Remote branch" spellcheck="false" autocomplete="off" data-autofocus />
      {#if setUpstream}
        <span class="hint">new, sets upstream</span>
      {/if}
    </div>
    {#if branchError && remoteBranch !== ""}
      <div class="error">{branchError}</div>
    {/if}

    <div class="commits" aria-label="Commits to push">
      {#if loadError}
        <div class="state error">{loadError}</div>
      {:else if !outgoing}
        <div class="state dim">{loading ? "Reading commits..." : ""}</div>
      {:else if outgoing.commits.length === 0}
        <div class="state dim">Nothing to push: {outgoing.base ?? "the remote"} has every commit.</div>
      {:else}
        {#each outgoing.commits as commit (commit.id)}
          <div class="commit" title={commit.summary}>
            <span class="subject truncate">{commit.summary}</span>
            <span class="author truncate dim">{commit.authorName}</span>
            <span class="when dim">{relativeTime(commit.time, now)}</span>
            <span class="hash mono dim">{commit.shortId}</span>
          </div>
        {/each}
      {/if}
    </div>
    {#if outgoing && outgoing.commits.length > 0}
      <div class="hint">
        {outgoing.commits.length}{outgoing.truncated ? "+" : ""}
        {outgoing.commits.length === 1 ? "commit" : "commits"}
        {outgoing.base ? `not on ${outgoing.base}` : "on no remote yet"}
      </div>
    {/if}

    <div class="options">
      <label class="check"><input type="checkbox" bind:checked={forceWithLease} /> Force push (--force-with-lease)</label>
      <label class="check"><input type="checkbox" bind:checked={pushTags} /> Push tags</label>
    </div>
    <div class="command selectable">{command}</div>
  {/if}

  {#snippet footer()}
    <span class="hint">&#8984;Enter to push</span>
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary" class:danger-fill={forceWithLease} disabled={!canPush} onclick={() => void submit()}>
      {forceWithLease ? "Force Push" : "Push"}
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .target {
    flex-wrap: wrap;
  }

  .local {
    font-weight: 600;
  }

  .target select {
    max-width: 160px;
  }

  .branch {
    flex: 1;
    min-width: 140px;
  }

  .commits {
    display: flex;
    flex-direction: column;
    min-height: 120px;
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--editor-bg);
  }

  .commit {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 120px 80px 70px;
    gap: 10px;
    align-items: center;
    padding: 4px 10px;
    border-bottom: 1px solid var(--border);
  }

  .hash {
    font-size: 11.5px;
    text-align: right;
  }

  .when {
    font-size: 12px;
  }

  .state {
    padding: 14px 10px;
  }

  .options {
    display: flex;
    gap: 18px;
  }
</style>
