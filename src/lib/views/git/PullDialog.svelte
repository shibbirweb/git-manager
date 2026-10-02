<!-- JetBrains' Pull dialog: the remote and branch to pull, and how: merge (the default),
     rebase or fast-forward only, with "No commit" for a merge. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { PullMode } from "$lib/types";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { defaultRemote, PULL_MODES, pullCommand, splitRemoteRef } from "./gitOptions";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  const refs = $derived(repoRoot === repoStore.repo?.root ? repoStore.refs : null);
  const remoteNames = $derived(refs?.remotes ?? repoStore.remotes.map((remote) => remote.name));
  const head = $derived(repoStore.statuses[repoRoot]?.head ?? null);

  const initial = untrack(() => {
    const names = refs?.remotes ?? repoStore.remotes.map((remote) => remote.name);
    const upstream = head?.upstream ? splitRemoteRef(head.upstream, names) : null;
    return { remoteName: upstream?.remoteName ?? defaultRemote(names) ?? "", branchName: upstream?.remoteBranch ?? head?.branch ?? "" };
  });

  let remoteName = $state(initial.remoteName);
  let branchName = $state(initial.branchName);
  let mode = $state<PullMode>("merge");
  let noCommit = $state(false);

  const branches = $derived((refs?.remote ?? []).filter((remoteBranch) => remoteBranch.remote === remoteName).map((remoteBranch) => remoteBranch.branch));
  const command = $derived(pullCommand({ remoteName: remoteName || null, branchName: branchName || null, mode, noCommit }));
  const canPull = $derived(remoteName !== "" && branchName.trim() !== "" && head?.branch != null && repoStore.busy === null);

  // A remote without the chosen branch: take its branch of the same name as HEAD, else its first one.
  $effect(() => {
    const list = branches;
    untrack(() => {
      if (list.length > 0 && !list.includes(branchName)) {
        branchName = list.find((name) => name === head?.branch) ?? list[0];
      }
    });
  });

  function close(): void {
    gitDialogs.close();
  }

  async function submit(): Promise<void> {
    if (!canPull) {
      return;
    }
    const options = { remoteName, branchName: branchName.trim(), mode, noCommit: noCommit && mode === "merge" };
    close();
    await repoStore.runOp(
      "Pull",
      (repoPath) => api.pullWithOptions(repoPath, options.remoteName, options.branchName, options.mode, options.noCommit),
      options.noCommit ? "Merged without committing: review and commit" : `Pulled ${options.remoteName}/${options.branchName}`,
      repoRoot,
    );
  }
</script>

<GitDialogFrame title="Pull to {head?.branch ?? 'HEAD'}" width={520} onCancel={close} onSubmit={() => void submit()}>
  {#if !head?.branch}
    <p class="error">HEAD is detached: check out a branch to pull into it.</p>
  {:else if remoteNames.length === 0}
    <p class="error">This repository has no remote. Add one with Git > Manage Remotes.</p>
  {:else}
    <div class="row">
      <label class="field remote">
        <span>Remote</span>
        <select class="input" bind:value={remoteName} data-autofocus>
          {#each remoteNames as name (name)}
            <option value={name}>{name}</option>
          {/each}
        </select>
      </label>
      <label class="field branch">
        <span>Branch</span>
        {#if branches.length > 0}
          <select class="input" bind:value={branchName}>
            {#each branches as name (name)}
              <option value={name}>{name}</option>
            {/each}
          </select>
        {:else}
          <input class="input mono" bind:value={branchName} spellcheck="false" autocomplete="off" placeholder="main" />
        {/if}
      </label>
    </div>

    <fieldset class="modes">
      <legend class="hint">Integrate the incoming changes with</legend>
      {#each PULL_MODES as option (option.value)}
        <label class="mode">
          <input type="radio" name="pull-mode" value={option.value} bind:group={mode} />
          <span class="mode-label">{option.label}</span>
          <span class="hint">{option.description}</span>
        </label>
      {/each}
    </fieldset>
    <label class="check" class:disabled={mode !== "merge"}>
      <input type="checkbox" bind:checked={noCommit} disabled={mode !== "merge"} />
      No commit (--no-commit): stop before the merge commit
    </label>
    <div class="command selectable">{command}</div>
  {/if}

  {#snippet footer()}
    <span class="hint">&#8984;Enter to pull</span>
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canPull} onclick={() => void submit()}>Pull</button>
  {/snippet}
</GitDialogFrame>

<style>
  .remote {
    width: 160px;
  }

  .branch {
    flex: 1;
    min-width: 0;
  }

  .modes {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: none;
  }

  .modes legend {
    padding: 0;
    margin-bottom: 4px;
  }

  .mode {
    display: grid;
    grid-template-columns: auto 130px 1fr;
    align-items: center;
    gap: 6px;
  }

  .mode-label {
    font-weight: 500;
  }

  .disabled {
    opacity: 0.55;
  }
</style>
