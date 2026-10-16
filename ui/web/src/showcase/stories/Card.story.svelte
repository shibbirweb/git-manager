<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Tag from "$ui/components/Tag.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack gap="md">
  <Card label="main worktree" padded selected>
    <Stack gap="xs">
      <Stack direction="row" align="center" gap="sm"><Text weight="semibold">main</Text><Tag>primary</Tag></Stack>
      <Text tone="dim" size="small">~/projects/storefront</Text>
    </Stack>
  </Card>
  <Card label="fix-login worktree" padded dim>
    <Stack gap="xs">
      <Stack direction="row" align="center" gap="sm"><Text weight="semibold">fix-login</Text><Tag>missing</Tag></Stack>
      <Text tone="dim" size="small">~/projects/storefront-fix-login</Text>
    </Stack>
  </Card>
</Stack>
