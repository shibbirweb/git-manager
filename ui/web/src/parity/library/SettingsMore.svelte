<!-- The library side of the Settings parity cases in cases/settingsMore.ts. -->
<script lang="ts">
  import Dialog from "$ui/components/Dialog.svelte";
  import Select from "$ui/components/Select.svelte";
  import SideNav from "$ui/components/SideNav.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import TextArea from "$ui/components/TextArea.svelte";

  let { id }: { id: string } = $props();
</script>

{#if id === "settings-nav"}
  <Dialog open title="Settings" variant="split" movable>
    {#snippet sidebar()}
      <SideNav label="Sections" items={[]} emptyText="Nothing found" />
      <Stack grow>{""}</Stack>
      <SideNav label="Reset" items={[{ id: "reset", label: "Reset to Defaults", danger: true }]} />
    {/snippet}
    {""}
  </Dialog>
{:else if id === "git-identity"}
  <Stack gap="sm">
    <Stack direction="row" gap="md" align="center" label="Identity">
      <Text size="small" weight="semibold">This repository</Text>
      <Text size="compact" tone="faint">storefront</Text>
      <Select size="small" label="Repository" value="sf" options={[{ value: "sf", label: "storefront" }]} />
    </Stack>
    <Stack gap="sm" label="Notes">
      <Text size="small" tone="dim">Used for commits here.</Text>
      <Text size="small" tone="warning">No email set.</Text>
    </Stack>
  </Stack>
{:else if id === "commit-template"}
  <Stack gap="xs" label="Template">
    <Text weight="medium">Feature</Text>
    <TextArea mono rows="normal" value="feat: " aria-label="Template" />
  </Stack>
{/if}
