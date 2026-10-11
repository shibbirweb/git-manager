<script lang="ts">
  import ResizeHandle from "$ui/components/ResizeHandle.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let size = $state(200);
</script>

<Stack direction="row" align="stretch" gap="none">
  <Stack padding="md"><Text>Panel: {size}px</Text></Stack>
  <ResizeHandle
    {size}
    side="left"
    min={100}
    max={400}
    defaultSize={200}
    label="Resize"
    onresize={(next) => (size = next)}
  />
  <Stack padding="md"><Text tone="dim">Hover the line between them.</Text></Stack>
</Stack>
