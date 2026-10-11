<script lang="ts">
  import ProgressBar from "$ui/components/ProgressBar.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack gap="xs">
  <Stack direction="row" justify="between"><Text>Web content (UI)</Text><Text mono>103 MB</Text></Stack>
  <ProgressBar value={0.57} label="Web content memory" />
</Stack>
<Stack gap="xs">
  <Stack direction="row" justify="between"><Text>5-hour limit</Text><Text mono>92%</Text></Stack>
  <ProgressBar value={0.92} tone="danger" label="5-hour limit" />
</Stack>
