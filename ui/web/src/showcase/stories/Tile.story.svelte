<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import Tile from "$ui/components/Tile.svelte";

  let picked = $state("nothing yet");
</script>

<Stack direction="row" gap="xl">
  <Tile icon="folder" label="Open" onclick={() => (picked = "Open")} />
  <Tile icon="cloud-download" label="Clone" onclick={() => (picked = "Clone")} />
  <Tile icon="folder-git" label="New" onclick={() => (picked = "New")} />
</Stack>
<Text tone="dim">Picked: {picked}</Text>
