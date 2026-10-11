<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Tag from "$ui/components/Tag.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Card label="main worktree" padded>
  <Stack gap="xs">
    <Stack direction="row" align="center" gap="sm"><Text weight="semibold">main</Text><Tag>primary</Tag></Stack>
    <Text tone="dim" size="small">~/projects/storefront</Text>
  </Stack>
</Card>
