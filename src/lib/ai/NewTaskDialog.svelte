<!-- New Task, like Orca: a task name becomes a branch and a worktree next to the repository, started from the default
     branch, with an agent in it. More agents race on the same task, each in its own worktree. The worktree logic is in
     taskModel.ts and aiTasks.ts. -->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { api } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { Refs, WorktreeInfo } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import GitDialogFrame from "$lib/views/git/GitDialogFrame.svelte";
  import { gitDialogs } from "$lib/views/git/gitDialogs.svelte";
  import { mainWorktreeRoot } from "$lib/views/git/worktrees/worktreeModel";
  import { repoTarget, validateBranchName } from "$lib/views/sidebar/actions";
  import { createTask } from "./aiTasks";
  import { agentPrograms } from "./sessions.svelte";
  import { MAX_RACE, taskSlug, taskWorktrees } from "./taskModel";

  let { repoRoot }: { repoRoot: string } = $props();

  let refs = $state.raw<Refs | null>(null);
  let worktrees = $state.raw<WorktreeInfo[]>([]);
  let taskName = $state("");
  let branch = $state("");
  /** The branch follows the task name until the user edits it. */
  let branchEdited = $state(false);
  let baseRef = $state("HEAD");
  /** One agent per worktree; "" makes a worktree with no agent. */
  let agents = $state<string[]>([]);
  let prompt = $state("");
  let prepare = $state(true);
  let creating = $state(false);
  let createError = $state<string | null>(null);

  const installed = $derived(agentPrograms.installed());
  const mainRoot = $derived(mainWorktreeRoot(worktrees, repoRoot));
  const localNames = $derived((refs?.local ?? []).map((local) => local.name));
  const baseChoices = $derived([...new Set([baseRef, "HEAD", ...localNames, ...(refs?.remote ?? []).map((remote) => remote.name)])]);
  const branchName = $derived(branch.trim());
  const planned = $derived(
    taskWorktrees(
      mainRoot,
      branchName,
      agents.length,
      new Set(localNames),
      new Set(worktrees.map((worktree) => worktree.path)),
    ),
  );
  const branchError = $derived(
    taskName.trim() === "" && branchName === ""
      ? "Name the task"
      : branchName === ""
        ? "Enter a branch name"
        : // A taken name is fine: the worktrees get the next free one (shown beside each agent).
          validateBranchName(branchName, branchName, repoTarget(repoRoot, refs)),
  );
  const canCreate = $derived(!creating && branchError === null && planned.length === agents.length && repoStore.busy === null);
  const links = $derived(settings.aiWorktreeLinks.join(", "));

  // The branch follows the task name until edited.
  $effect(() => {
    const slug = taskSlug(taskName);
    untrack(() => {
      if (!branchEdited) {
        branch = slug;
      }
    });
  });

  onMount(() => {
    void agentPrograms.load().then(() => {
      if (agents.length === 0) {
        const preferred = installed.find((agent) => agent.id === settings.aiDefaultAgent) ?? installed[0];
        agents = [preferred?.id ?? ""];
      }
    });
    void Promise.all([
      api.getRefs(repoRoot).catch(() => null),
      api.listWorktrees(repoRoot).catch(() => [] as WorktreeInfo[]),
      api.worktreeDefaultBase(repoRoot).catch(() => "HEAD"),
    ]).then(([loadedRefs, loadedWorktrees, defaultBase]) => {
      refs = loadedRefs;
      worktrees = loadedWorktrees;
      baseRef = defaultBase;
    });
  });

  function close(): void {
    if (!creating) {
      gitDialogs.close();
    }
  }

  function addAgent(): void {
    if (agents.length < MAX_RACE) {
      agents = [...agents, agents[agents.length - 1] ?? installed[0]?.id ?? ""];
    }
  }

  async function submit(): Promise<void> {
    if (!canCreate) {
      return;
    }
    creating = true;
    createError = null;
    const result = await createTask({
      repoRoot,
      mainRoot,
      baseRef,
      worktrees: planned.map((worktree, index) => ({ ...worktree, agentId: agents[index] ?? "" })),
      prompt,
      prepare,
    });
    creating = false;
    if (result.error && result.created.length === 0) {
      createError = result.error;
      return;
    }
    gitDialogs.close();
    if (result.error) {
      createError = result.error;
    }
  }
</script>

<GitDialogFrame title="New Task" width={580} closable={!creating} onCancel={close} onSubmit={() => void submit()}>
  <label class="field">
    <span>Task</span>
    <input
      class="input"
      bind:value={taskName}
      disabled={creating}
      placeholder="Fix the login race"
      spellcheck="false"
      autocomplete="off"
      data-autofocus
    />
  </label>

  <div class="row">
    <label class="field grow">
      <span>Branch</span>
      <input
        class="input mono"
        bind:value={branch}
        oninput={() => (branchEdited = true)}
        disabled={creating}
        spellcheck="false"
        autocomplete="off"
        placeholder="fix-the-login-race"
      />
    </label>
    <label class="field base">
      <span>From</span>
      <select class="input" bind:value={baseRef} disabled={creating}>
        {#each baseChoices as choice (choice)}
          <option value={choice}>{choice}</option>
        {/each}
      </select>
    </label>
  </div>
  {#if branchError && (taskName !== "" || branch !== "")}
    <div class="error">{branchError}</div>
  {:else if planned[0] && planned[0].branchName !== branchName}
    <div class="hint">{branchName} is taken, so the next free name is used.</div>
  {/if}

  <div class="field">
    <span>{agents.length > 1 ? `Agents (${agents.length} race on this task, each in its own worktree)` : "Agent"}</span>
    {#each agents as agentId, index (index)}
      {@const worktree = planned[index]}
      <div class="agent-row">
        <select class="input agent-select" bind:value={agents[index]} disabled={creating} aria-label="Agent {index + 1}">
          {#each installed as agent (agent.id)}
            <option value={agent.id}>{agent.label}</option>
          {/each}
          <option value="">No agent (worktree only)</option>
        </select>
        <span class="target dim truncate" title={worktree?.folderPath ?? ""}>
          {#if worktree}
            <Icon name="branch" size={11} />{worktree.branchName}
          {/if}
        </span>
        {#if agents.length > 1}
          <button
            type="button"
            class="icon-btn"
            title="Remove this agent"
            aria-label="Remove agent {index + 1}"
            disabled={creating}
            onclick={() => (agents = agents.filter((_, other) => other !== index))}
          >
            <Icon name="x" size={12} />
          </button>
        {/if}
      </div>
      {#if agentId === "" && installed.length === 0 && index === 0}
        <div class="hint">No AI agents found on your PATH: the worktree is made without one.</div>
      {/if}
    {/each}
    {#if agents.length < MAX_RACE}
      <button type="button" class="btn small add-agent" onclick={addAgent} disabled={creating}>
        <Icon name="plus" size={12} />
        Add Agent to Race
      </button>
    {/if}
  </div>

  <label class="field">
    <span>First prompt (optional)</span>
    <textarea
      class="input prompt"
      rows="3"
      bind:value={prompt}
      disabled={creating}
      placeholder="What should the agents do? Each one gets the same prompt."
    ></textarea>
  </label>

  <label class="check">
    <input type="checkbox" bind:checked={prepare} disabled={creating} />
    Get it ready to run: copy the files listed in .worktreeinclude{links ? ` and link ${links}` : ""}
  </label>

  {#if creating}
    <div class="row hint" role="status">
      <span class="spinner" aria-hidden="true"></span>
      Creating {agents.length === 1 ? "the worktree" : `${agents.length} worktrees`}...
    </div>
  {/if}
  {#if createError}
    <div class="error selectable">{createError}</div>
  {/if}

  {#snippet footer()}
    <button type="button" class="btn" onclick={close} disabled={creating}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canCreate} onclick={() => void submit()}>
      {creating ? "Creating..." : agents.length > 1 ? `Create ${agents.length} Worktrees` : "Create Task"}
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .base {
    width: 190px;
  }

  .agent-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .agent-select {
    flex: none;
    width: 220px;
  }

  .target {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-family: var(--font-mono);
  }

  .add-agent {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
  }

  .prompt {
    width: 100%;
    resize: vertical;
    font-family: inherit;
  }
</style>
