<script lang="ts">
  import ResourceLink from "$ui/components/ResourceLink.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let opened = $state("nothing yet");
</script>

<Stack gap="xs">
  <ResourceLink
    icon="book"
    title="Documentation"
    description="A guide to every feature, on the GitHub wiki."
    onclick={() => (opened = "Documentation")}
  />
  <ResourceLink icon="keyboard" title="Keyboard shortcuts" onclick={() => (opened = "Shortcuts")} />
</Stack>
<Text tone="dim">Opened: {opened}</Text>
