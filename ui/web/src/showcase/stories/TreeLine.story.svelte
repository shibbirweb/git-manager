<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import ListRow from "$ui/components/ListRow.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import TreeLine from "$ui/components/TreeLine.svelte";
</script>

<Card label="Terminals">
  <Stack paddingX="sm">
    <ListRow label="zsh" icon="terminal" />
    {#each ["first", "middle", "last"] as const as position, index (position)}
      <Stack direction="row" gap="xs" align="stretch">
        <TreeLine {position} />
        <Stack direction="row" gap="xs" align="center" paddingY="xs">
          <Icon name="terminal" size="normal" />
          <Text>split {index + 1}</Text>
        </Stack>
      </Stack>
    {/each}
  </Stack>
</Card>
