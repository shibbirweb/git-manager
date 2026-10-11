<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import SplitPane from "$ui/components/SplitPane.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let size = $state(220);
</script>

<Text tone="dim">Drag the line, use the arrow keys on it, or double-click to reset. Width: {size}px</Text>
<Card label="Split example">
  <Stack direction="row" align="stretch">
    <SplitPane label="Resize the sidebar" bind:size min={140} max={420} defaultSize={220}>
      {#snippet first()}<EmptyState title="Sidebar" />{/snippet}
      {#snippet second()}<EmptyState title="Editor" hint="Takes the rest" />{/snippet}
    </SplitPane>
  </Stack>
</Card>
