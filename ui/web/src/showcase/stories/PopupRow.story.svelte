<script lang="ts">
  import PopupRow from "$ui/components/PopupRow.svelte";
  import Stack from "$ui/components/Stack.svelte";

  const branches = ["main", "feature/tax", "fix/cart-total"];
  let highlighted = $state("main");
</script>

<Stack gap="none">
  <PopupRow variant="action" icon="plus" label="New Branch..." />
  <PopupRow variant="action" icon="cloud-download" label="Fetch" hint="origin" />
  {#each branches as branch (branch)}
    <PopupRow
      icon="branch"
      label={branch}
      current={branch === "main"}
      chevron
      highlighted={highlighted === branch}
      onhover={() => (highlighted = branch)}
    />
  {/each}
  <PopupRow icon="branch" label="old/removed" hint="gone" disabled />
</Stack>
