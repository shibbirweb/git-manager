<script lang="ts">
  import Chip from "$ui/components/Chip.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let font = $state("JetBrains Mono");
</script>

<Stack direction="row" gap="sm" align="center">
  <Chip text="2 waiting" tone="warning" icon="alert" onclick={() => undefined} />
  <Chip text="5 running" icon="play" />
</Stack>
<Stack direction="row" gap="sm" wrap>
  {#each ["JetBrains Mono", "Menlo", "SF Mono", "Fira Code"] as family (family)}
    <Chip variant="pick" text={family} fontFamily={family} onclick={() => (font = family)} />
  {/each}
</Stack>
<Text tone="dim">Font: {font}</Text>
