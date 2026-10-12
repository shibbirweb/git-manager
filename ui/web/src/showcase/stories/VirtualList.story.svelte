<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import VirtualList from "$ui/components/VirtualList.svelte";

  const commits = Array.from({ length: 100_000 }, (_, index) => ({
    hash: (index * 2654435761).toString(16).slice(-7).padStart(7, "0"),
    subject: `Commit number ${index + 1}`,
  }));
</script>

<Text tone="dim">100,000 rows; only the ones in view are drawn.</Text>
<Stack>
  <VirtualList items={commits} height="medium" label="Commits">
    {#snippet row(commit)}
      <Stack direction="row" align="center" gap="md" padding="xs">
        <Text mono tone="dim" size="small">{commit.hash}</Text>
        <Text truncate>{commit.subject}</Text>
      </Stack>
    {/snippet}
  </VirtualList>
</Stack>
