<script lang="ts">
  import Pill from "$ui/components/Pill.svelte";
  import Stack from "$ui/components/Stack.svelte";
</script>

<Stack direction="row" gap="sm" align="center">
  <Pill>Read-only</Pill>
  <Pill tone="accent">Modified</Pill>
  <Pill tone="success">read</Pill>
  <Pill tone="warning">Unsaved</Pill>
  <Pill tone="danger">Conflict</Pill>
  <Pill tone="warning" strong>Merging</Pill>
  <Pill tone="warning" variant="outline">+60 MB</Pill>
  <Pill variant="outline">+2 MB</Pill>
</Stack>
