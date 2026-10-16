<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import ZoomBar from "$ui/components/ZoomBar.svelte";

  let zoom = $state<number | null>(null);
</script>

<Stack direction="row" gap="xs" align="center"><ZoomBar bind:zoom fitted={0.42} /></Stack>
<Text tone="dim">Zoom: {zoom === null ? "fit (42%)" : `${Math.round(zoom * 100)}%`}</Text>
