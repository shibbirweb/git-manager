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
  <Button variant="ghost" icon="branch" trailingIcon="chevron-down">feature/login</Button>
  <Text tone="dim">Clicked {clicks} times</Text>
</Stack>
<Stack direction="row" align="center" gap="xs">
  <Button size="tiny" icon="minus" aria-label="Zoom out" />
  <Button size="tiny" pressed>Fit</Button>
  <Button size="tiny" pressed={false}>100%</Button>
  <Button size="tiny">Reveal in Finder</Button>
  <Button size="small" icon="settings" aria-label="Commit options" badge={2} />
</Stack>
