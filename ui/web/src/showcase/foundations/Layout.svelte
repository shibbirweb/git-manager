<!-- The grid and the breakpoints from tokens.json, with a live Grid and the current window and panel size names. -->
<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import Grid from "$ui/components/Grid.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Tag from "$ui/components/Tag.svelte";
  import Text from "$ui/components/Text.svelte";
  import { panelSize, windowSize } from "$ui/logic/breakpoints";
  import { breakpoints, grid } from "$ui/styles/tokens";

  let width = $state(innerWidth);
</script>

<svelte:window bind:innerWidth={width} />

<article class="selectable">
  <Stack gap="xl" padding="xxl">
    <Stack gap="xs">
      <Text variant="display" element="h1">Layout</Text>
      <Text tone="dim">
        Grid and breakpoints from ui/design-tokens/tokens.json. Windows are compact, regular or wide; panels are
        tiny to wide. Layouts change at these widths on every platform.
      </Text>
    </Stack>
    <Stack gap="sm">
      <Text variant="sectionLabel">Breakpoints</Text>
      <Stack direction="row" gap="sm" wrap>
        {#each Object.entries(breakpoints) as [name, value] (name)}
          <Tag>{name} {value}px</Tag>
        {/each}
      </Stack>
      <Text>
        This window is {width}px wide: a <Tag tone="accent">{windowSize(width)}</Tag> window; as a panel it would be
        <Tag tone="accent">{panelSize(width)}</Tag>.
      </Text>
    </Stack>
    <Stack gap="sm">
      <Text variant="sectionLabel">Grid</Text>
      <Stack direction="row" gap="sm" wrap>
        {#each Object.entries(grid) as [name, value] (name)}
          <Tag>{name} {value}</Tag>
        {/each}
      </Stack>
      <Grid label="Auto grid">
        {#each Array.from({ length: 8 }, (_, index) => index + 1) as item (item)}
          <Card padded label="Cell {item}"><Text>Cell {item}</Text></Card>
        {/each}
      </Grid>
      <Grid columns={3} gap="md" label="Three columns">
        {#each ["One", "Two", "Three"] as item (item)}
          <Card padded label={item}><Text>{item} of 3</Text></Card>
        {/each}
      </Grid>
    </Stack>
  </Stack>
</article>

<style>
  article {
    max-width: 980px;
  }
</style>
