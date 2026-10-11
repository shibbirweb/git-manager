<script lang="ts">
  import Spinner from "$ui/components/Spinner.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack direction="row" align="center" gap="lg">
  <Spinner label="Loading the log" />
  <Text tone="dim">Loading the log</Text>
  <Spinner size="large" />
</Stack>
