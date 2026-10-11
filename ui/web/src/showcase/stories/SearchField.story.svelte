<script lang="ts">
  import SearchField from "$ui/components/SearchField.svelte";
  import Text from "$ui/components/Text.svelte";

  let query = $state("");
</script>

<SearchField label="Search settings" placeholder="Search settings" bind:value={query} />
<Text tone="dim">Query: "{query}". Esc clears it.</Text>
