<!-- The library side of the Changes panel parity cases (cases/sections.ts). -->
<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Collapsible from "$ui/components/Collapsible.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import Fieldset from "$ui/components/Fieldset.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Pill from "$ui/components/Pill.svelte";
  import Popover from "$ui/components/Popover.svelte";
  import Text from "$ui/components/Text.svelte";

  let { id }: { id: string } = $props();
  const repos = [
    { value: "a", label: "storefront (3)" },
    { value: "b", label: "docs (1)" },
  ];
</script>

{#if id === "repo-actions"}
  <span style="display: flex; gap: 1px; width: 400px">
    <IconButton icon="sync" label="Sync" size="row" iconSize="medium" count="2↓ 1↑" />
    <IconButton icon="refresh" label="Refresh" size="row" iconSize="medium" spinning />
  </span>
{:else if id === "op-badge"}
  <Pill tone="warning" strong>MERGING</Pill>
{:else if id === "clean-list-head"}
  <div style="width: 300px">
    <Collapsible title="No Changes" count={3} dim>{""}</Collapsible>
  </div>
{:else if id === "group-nested"}
  <div style="width: 300px">
    <Collapsible title="Changes" count={2} nested>
      {#snippet actions()}<IconButton icon="plus" label="Stage all" size="row" iconSize="medium" />{/snippet}
      {""}
    </Collapsible>
  </div>
{:else if id === "no-repo"}
  <div style="width: 300px; height: 260px; display: flex">
    <EmptyState
      variant="pane"
      icon="folder-git"
      iconStyle="circle"
      iconTone="accent"
      strong
      title="No git repository"
      hint="Initialize one here."
    >
      {#snippet action()}<Button size="small" variant="primary">Initialize Repository</Button>{/snippet}
    </EmptyState>
  </div>
{:else if id === "commit-options-panel"}
  <Popover open label="Commit Options" padding="form" placement="below" width="medium">
    {#snippet trigger()}<span></span>{/snippet}
    <Text weight="semibold">Commit Options</Text>
    <Fieldset legend="GPG sign" legendTone="dim">{""}</Fieldset>
    <Text size="small" tone="faint">Applies to every commit.</Text>
  </Popover>
{/if}
