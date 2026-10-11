<script lang="ts">
  import Icon from "$ui/components/Icon.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import { icons, type IconName } from "$ui/icons";

  const names = Object.keys(icons) as IconName[];
</script>

<Stack direction="row" gap="lg">
  <Icon name="alert" tone="danger" />
  <Icon name="check" tone="success" />
  <Icon name="bell" tone="accent" />
  <Icon name="lock" tone="dim" />
</Stack>
<Stack direction="row" wrap gap="md">
  {#each names as name (name)}
    <Stack direction="row" align="center" gap="sm">
      <Icon {name} />
      <Text size="xsmall" tone="dim">{name}</Text>
    </Stack>
  {/each}
</Stack>
