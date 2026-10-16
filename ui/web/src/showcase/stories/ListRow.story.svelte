<script lang="ts">
  import ListRow from "$ui/components/ListRow.svelte";
  import Stack from "$ui/components/Stack.svelte";

  let highlighted = $state(0);
  const rows = [
    { label: "main", description: "current" },
    { label: "develop", description: "3 ahead" },
    { label: "feature/login", description: "" },
  ];
</script>

<Stack gap="none">
  {#each rows as row, index (row.label)}
    <ListRow
      icon="branch"
      label={row.label}
      description={row.description}
      highlighted={index === highlighted}
      onhover={() => (highlighted = index)}
    />
  {/each}
  <ListRow label="old-work" description="disabled" disabled />
</Stack>
