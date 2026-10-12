<!-- The library side of the status bar parity cases (cases/status.ts). -->
<script lang="ts">
  import Divider from "$ui/components/Divider.svelte";
  import Meter from "$ui/components/Meter.svelte";
  import Popover from "$ui/components/Popover.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import StatusBar from "$ui/components/StatusBar.svelte";
  import StatusItem from "$ui/components/StatusItem.svelte";
  import Text from "$ui/components/Text.svelte";

  let { id }: { id: string } = $props();
  const none = () => undefined;
</script>

{#if id === "ai-usage-item"}
  <StatusItem onclick={none} label="AI usage">
    {#snippet leading()}<Meter variant="mini" fraction={0.8} tone="warning" />{/snippet}
    {#snippet trailing()}<Text tone="warning" size="small">80% used</Text>{/snippet}
  </StatusItem>
{:else if id === "keep-awake"}
  <StatusItem variant="quiet" active icon="coffee" text="Awake" onclick={none} />
{:else if id === "status-details"}
  <Popover open label="Memory" placement="below" width="medium" padding="panel">
    {#snippet trigger()}<span></span>{/snippet}
    <Stack direction="row" justify="between"><Text weight="semibold">Memory</Text><Text>126 MB</Text></Stack>
    <Divider />
    <Stack label="GPU" gap="xs">
      <Text size="xsmall" weight="semibold" tone="dim">GPU</Text>
      <Text size="xsmall" tone="dim">Shared with the system.</Text>
    </Stack>
  </Popover>
{:else if id === "status-states"}
  <StatusBar>
    {#snippet start()}
      <StatusItem text="Fetch" tone="warning" onclick={none} />
      <StatusItem icon="sync" text="2↓" spin disabled onclick={none} />
    {/snippet}
  </StatusBar>
{/if}
