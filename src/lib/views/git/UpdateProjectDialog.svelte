<!-- Update Project: pulls every repository of the workspace, merging or rebasing
     the incoming changes; the choice is remembered. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import Dialog from "@git-manager/ui/components/Dialog.svelte";
  import Fieldset from "@git-manager/ui/components/Fieldset.svelte";
  import RadioGroup from "@git-manager/ui/components/RadioGroup.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { localKeys } from "$lib/commands/commandRuntime";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings, type UpdateMethod } from "$lib/stores/settings.svelte";
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

<Dialog open variant="form" title="Update Project" width="normal" onclose={close} onsubmit={() => void submit()}>
  <Text variant="paragraph" tone="dim">
    {plan.steps.length === 0
      ? "No repository can be updated."
      : plan.steps.length === 1
        ? `Pulls ${plan.steps[0].name} from its upstream.`
        : `Pulls ${plan.steps.length} repositories from their upstreams, one after another. It stops at the first ` +
          "conflict."}
  </Text>
  <Fieldset legend="Update type">
    <RadioGroup
      name="update-method"
      label="Update type"
      bind:value={method}
      options={[
        { value: "merge", label: "Merge incoming changes into the current branch" },
        { value: "rebase", label: "Rebase the current branch on top of incoming changes" },
      ]}
    />
  </Fieldset>
  {#if plan.skipped.length > 0}
    <Stack gap="xxs" maxHeight="xsmall" scroll="y">
      <Text variant="hint" tone="faint">Skipped</Text>
      {#each plan.skipped as entry (entry.name)}
        <Text variant="hint" tone="faint">{entry.name}: {entry.reason}</Text>
      {/each}
    </Stack>
  {/if}

  {#snippet footnote()}
    <Text variant="hint" tone="faint">{localKeys("CmdOrCtrl+Enter")} to update</Text>
  {/snippet}
  {#snippet actions()}
    <Button onclick={close}>Cancel</Button>
    <Button
      variant="primary"
      disabled={plan.steps.length === 0 || repoStore.busy !== null}
      onclick={() => void submit()}
    >
      Update
    </Button>
  {/snippet}
</Dialog>
