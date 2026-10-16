<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Switch from "$ui/components/Switch.svelte";
  import Text from "$ui/components/Text.svelte";

  let wrap = $state(true);
</script>

<Stack direction="row" align="center" gap="lg">
  <Switch label="Word wrap" bind:checked={wrap} />
  <Text>Word wrap is {wrap ? "on" : "off"}</Text>
</Stack>
<Stack direction="row" align="center" gap="lg">
  <Switch label="Disabled" disabled />
  <Switch label="Disabled on" checked disabled />
</Stack>
