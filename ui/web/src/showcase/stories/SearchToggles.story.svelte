<script lang="ts">
  import SearchToggles from "$ui/components/SearchToggles.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let options = $state({ matchCase: false, wholeWords: true, regex: false });
</script>

<Stack direction="row" align="center" gap="lg">
  <SearchToggles bind:options />
  <SearchToggles bind:options compact />
  <Text tone="dim">{JSON.stringify(options)}</Text>
</Stack>
