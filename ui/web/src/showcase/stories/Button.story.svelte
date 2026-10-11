<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let clicks = $state(0);
</script>

<Stack direction="row" align="center">
  <Button onclick={() => clicks++}>Cancel</Button>
  <Button variant="primary" icon="check" onclick={() => clicks++}>Commit</Button>
  <Button variant="danger">Discard</Button>
  <Button variant="danger-primary">Delete Branch</Button>
  <Button disabled>Disabled</Button>
</Stack>
<Stack direction="row" align="center">
  <Button size="small">Small</Button>
  <Button size="small" variant="primary" icon="arrow-up">Push</Button>
  <Text tone="dim">Clicked {clicks} times</Text>
</Stack>
