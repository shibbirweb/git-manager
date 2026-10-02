<!-- JetBrains' Update Project: pulls every repository of the workspace, merging or rebasing
     the incoming changes; the choice is remembered. -->
<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings, type UpdateMethod } from "$lib/stores/settings.svelte";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { updateProject } from "./gitMenuActions";
  import { updatePlan } from "./gitOptions";

  let method = $state<UpdateMethod>(settings.updateMethod);

  const plan = $derived(updatePlan(repoStore.repos, repoStore.statuses));

  function close(): void {
    gitDialogs.close();
  }

  async function submit(): Promise<void> {
    if (plan.steps.length === 0 || repoStore.busy !== null) {
      return;
    }
    if (method !== settings.updateMethod) {
      settings.setPreference("updateMethod", method);
    }
    close();
    await updateProject();
  }
</script>

<GitDialogFrame title="Update Project" width={500} onCancel={close} onSubmit={() => void submit()}>
  <p class="dim intro">
    {plan.steps.length === 0
      ? "No repository can be updated."
      : plan.steps.length === 1
        ? `Pulls ${plan.steps[0].name} from its upstream.`
        : `Pulls ${plan.steps.length} repositories from their upstreams, one after another. It stops at the first conflict.`}
  </p>
  <fieldset class="methods">
    <legend class="hint">Update type</legend>
    <label class="check">
      <input type="radio" name="update-method" value="merge" bind:group={method} data-autofocus />
      Merge incoming changes into the current branch
    </label>
    <label class="check">
      <input type="radio" name="update-method" value="rebase" bind:group={method} />
      Rebase the current branch on top of incoming changes
    </label>
  </fieldset>
  {#if plan.skipped.length > 0}
    <div class="skipped">
      <div class="hint">Skipped</div>
      {#each plan.skipped as entry (entry.name)}
        <div class="hint">{entry.name}: {entry.reason}</div>
      {/each}
    </div>
  {/if}

  {#snippet footer()}
    <span class="hint">&#8984;Enter to update</span>
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary" disabled={plan.steps.length === 0 || repoStore.busy !== null} onclick={() => void submit()}>
      Update
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .intro {
    margin: 0;
    line-height: 1.5;
  }

  .methods {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: none;
  }

  .methods legend {
    padding: 0;
    margin-bottom: 4px;
  }

  .skipped {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 120px;
    overflow-y: auto;
  }
</style>
