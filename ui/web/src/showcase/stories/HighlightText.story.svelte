<script lang="ts">
  import HighlightText from "$ui/components/HighlightText.svelte";
  import Stack from "$ui/components/Stack.svelte";
</script>

<Stack>
  <HighlightText text="src/lib/stores/repo.svelte.ts" ranges={[[15, 19]]} />
  <HighlightText text="const total = cart.total();" ranges={[[6, 11], [19, 24]]} variant="mark" />
</Stack>
