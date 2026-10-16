<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Tag from "$ui/components/Tag.svelte";
</script>

<Stack direction="row" align="center" gap="sm">
  <Tag>primary</Tag>
  <Tag>folder</Tag>
  <Tag tone="accent">current</Tag>
  <Tag tone="danger">conflict</Tag>
  <Tag tone="success">merged</Tag>
  <Tag tone="warning">behind</Tag>
  <Tag variant="outline">submodule</Tag>
  <Tag variant="outline">nested</Tag>
</Stack>
