<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import StatusDot from "$ui/components/StatusDot.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack gap="sm">
  <Stack direction="row" gap="sm" align="center"><StatusDot tone="success" /><Text>git fetch finished</Text></Stack>
  <Stack direction="row" gap="sm" align="center"><StatusDot tone="danger" /><Text>git push failed</Text></Stack>
  <Stack direction="row" gap="sm" align="center">
    <StatusDot pulse label="Running" />
    <Text>git pull is running</Text>
  </Stack>
  <Stack direction="row" gap="sm" align="center"><StatusDot size="small" /><Text>Keep awake off</Text></Stack>
</Stack>
