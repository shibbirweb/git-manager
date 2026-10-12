<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack gap="xs">
  <Text weight="semibold">A column with a small gap</Text>
  <Text tone="dim">Every gap is a spacing token, never a pixel value.</Text>
</Stack>
<Stack direction="row" justify="between" align="center">
  <Text>Row, space between</Text>
  <Stack direction="row" gap="sm">
    <Button>Cancel</Button>
    <Button variant="primary">Save</Button>
  </Stack>
</Stack>
<Stack direction="row" wrap gap="xs">
  {#each ["main", "develop", "feature/login", "fix/crash", "release/1.0"] as branch (branch)}
    <Button size="small" icon="branch">{branch}</Button>
  {/each}
</Stack>
<Text tone="dim" size="small">scroll="x": the row scrolls in its own box instead of widening the page.</Text>
<Stack direction="row" gap="xs" scroll="x" paddingY="xs">
  {#each Array.from({ length: 14 }, (_, index) => `feature/branch-${index + 1}`) as branch (branch)}
    <Button size="small" icon="branch">{branch}</Button>
  {/each}
</Stack>
