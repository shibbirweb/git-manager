<script lang="ts">
  import Pill from "$ui/components/Pill.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";
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
<Text size="small" tone="dim">In a narrow file bar (under 480 px) the pills are dots:</Text>
<Stack direction="row" gap="sm" width="xlarge">
  <Toolbar variant="file" label="File" responsive>
    <Pill tone="warning" title="Unsaved changes" dotAt="compact">Unsaved</Pill>
    <Pill tone="accent" title="Modified" dotAt="compact">Modified</Pill>
  </Toolbar>
</Stack>
