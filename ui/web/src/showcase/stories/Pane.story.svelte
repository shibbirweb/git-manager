<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import ListRow from "$ui/components/ListRow.svelte";
  import Pane from "$ui/components/Pane.svelte";
  import SectionTitle from "$ui/components/SectionTitle.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let selected = $state("10:42");
  const versions = [
    { day: "Today", time: "10:42", label: "Saved" },
    { day: "", time: "10:15", label: "Before reset" },
    { day: "Yesterday", time: "17:30", label: "Committed" },
  ];
  const deleted = [
    { name: "tax.ts", folder: "src/lib", when: "2 days ago" },
    { name: "old-cart.ts", folder: "src/lib/legacy", when: "last week" },
  ];
</script>

<Card label="Local History">
  <Stack direction="row" align="stretch">
    <Pane label="Versions">
      <div role="listbox" aria-label="Versions" tabindex="0">
        <SectionTitle variant="day" title="Today" />
        {#each versions as version (version.time)}
          {#if version.day}<SectionTitle variant="day" title={version.day} />{/if}
          <ListRow
            label={version.time}
            description={version.label}
            highlighted={selected === version.time}
            onclick={() => (selected = version.time)}
          />
        {/each}
      </div>
    </Pane>
    <Stack grow><EmptyState title="Version {selected}" hint="Its diff shows here." /></Stack>
  </Stack>
</Card>
<Card label="Deleted files">
  {#each deleted as file (file.name)}
    <Stack direction="row" align="center" gap="sm" paddingX="sm" paddingY="xs">
      <Text weight="semibold">{file.name}</Text>
      <Stack grow><Text tone="dim" size="small" truncate>{file.folder}</Text></Stack>
      <Text tone="faint" size="small">{file.when}</Text>
    </Stack>
  {/each}
</Card>
