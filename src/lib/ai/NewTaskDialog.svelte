<!-- New Task, like Orca: a task name becomes a branch and a worktree next to the repository, started from the default
     branch, with an agent in it. More agents race on the same task, each in its own worktree. The worktree logic is in
     taskModel.ts and aiTasks.ts. -->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import Checkbox from "@nibtree/ui/components/Checkbox.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import Field from "@nibtree/ui/components/Field.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Select from "@nibtree/ui/components/Select.svelte";
  import Spinner from "@nibtree/ui/components/Spinner.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import TextArea from "@nibtree/ui/components/TextArea.svelte";
  import { onMount, untrack } from "svelte";
  import { api } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { Refs, WorktreeInfo } from "$lib/types";
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
  const agentChoices = $derived([
    ...installed.map((agent) => ({ value: agent.id, label: agent.label })),
    { value: "", label: "No agent (worktree only)" },
  ]);
  const agentsLabel = $derived(
    agents.length > 1 ? `Agents (${agents.length} race on this task, each in its own worktree)` : "Agent",
  );
  const mainRoot = $derived(mainWorktreeRoot(worktrees, repoRoot));
  const localNames = $derived((refs?.local ?? []).map((local) => local.name));
  const remoteNames = $derived((refs?.remote ?? []).map((remote) => remote.name));
  const baseChoices = $derived([...new Set([baseRef, "HEAD", ...localNames, ...remoteNames])]);
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
  const canCreate = $derived(
    !creating && branchError === null && planned.length === agents.length && repoStore.busy === null,
  );
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

<Dialog
  open
  variant="form"
  title="New Task"
  width="medium"
  dismissible={!creating}
  onclose={close}
  onsubmit={() => void submit()}
>
  <Field label="Task" look="compact">
    <Input
      width="fill"
      bind:value={taskName}
      disabled={creating}
      placeholder="Fix the login race"
      spellcheck="false"
      autocomplete="off"
      autofocus
    />
  </Field>

  <Stack direction="row" align="end" gap="md">
    <Stack grow>
      <Field label="Branch" look="compact">
        <Input
          mono
          width="fill"
          bind:value={branch}
          oninput={() => (branchEdited = true)}
          disabled={creating}
          spellcheck="false"
          autocomplete="off"
          placeholder="fix-the-login-race"
        />
      </Field>
    </Stack>
    <Field label="From" look="compact">
      <Select
        label="From"
        width="medium"
        bind:value={baseRef}
        disabled={creating}
        options={baseChoices.map((choice) => ({ value: choice, label: choice }))}
      />
    </Field>
  </Stack>
  {#if branchError && (taskName !== "" || branch !== "")}
    <Text size="small" tone="danger">{branchError}</Text>
  {:else if planned[0] && planned[0].branchName !== branchName}
    <Text variant="hint" tone="faint">{branchName} is taken, so the next free name is used.</Text>
  {/if}

  <Field label={agentsLabel} look="compact">
    <Stack gap="xs">
      {#each agents as agentId, index (index)}
        {@const worktree = planned[index]}
        <Stack direction="row" align="center" gap="md">
          <Select
            label="Agent {index + 1}"
            width="medium"
            bind:value={agents[index]}
            disabled={creating}
            options={agentChoices}
          />
          <Stack direction="row" align="center" gap="xs" grow>
            {#if worktree}
              <Icon name="branch" size="small" tone="dim" />
              <Text mono size="small" tone="dim" truncate title={worktree.folderPath}>{worktree.branchName}</Text>
            {/if}
          </Stack>
          {#if agents.length > 1}
            <IconButton
              icon="x"
              iconSize="compact"
              size="small"
              label="Remove agent {index + 1}"
              title="Remove this agent"
              disabled={creating}
              onclick={() => (agents = agents.filter((_, other) => other !== index))}
            />
          {/if}
        </Stack>
        {#if agentId === "" && installed.length === 0 && index === 0}
          <Text variant="hint" tone="faint">No AI agents found on your PATH: the worktree is made without one.</Text>
        {/if}
      {/each}
      {#if agents.length < MAX_RACE}
        <Stack direction="row">
          <Button size="small" icon="plus" onclick={addAgent} disabled={creating}>Add Agent to Race</Button>
        </Stack>
      {/if}
    </Stack>
  </Field>

  <Field label="First prompt (optional)" look="compact">
    <TextArea
      rows="normal"
      resize="vertical"
      bind:value={prompt}
      disabled={creating}
      placeholder="What should the agents do? Each one gets the same prompt."
    />
  </Field>

  <Checkbox
    bind:checked={prepare}
    disabled={creating}
    label="Get it ready to run: copy the files listed in .worktreeinclude{links ? ` and link ${links}` : ''}"
  />

  {#if creating}
    <Stack direction="row" align="center" gap="md" role="status">
      <Spinner size="small" label="Creating" />
      <Text variant="hint" tone="faint">
        Creating {agents.length === 1 ? "the worktree" : `${agents.length} worktrees`}...
      </Text>
    </Stack>
  {/if}
  {#if createError}
    <Text size="small" tone="danger" selectable>{createError}</Text>
  {/if}

  {#snippet actions()}
    <Button onclick={close} disabled={creating}>Cancel</Button>
    <Button variant="primary" disabled={!canCreate} onclick={() => void submit()}>
      {creating ? "Creating..." : agents.length > 1 ? `Create ${agents.length} Worktrees` : "Create Task"}
    </Button>
  {/snippet}
</Dialog>
