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
<Stack direction="row" align="center" gap="lg">
  <Spinner delayed label="Loading the diff" />
  <Text tone="dim">delayed: shows after 250 ms (reload the page to see it fade in)</Text>
</Stack>
