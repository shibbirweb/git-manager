<script lang="ts">
  import Badge from "$ui/components/Badge.svelte";
  import Button from "$ui/components/Button.svelte";
  import Grid from "$ui/components/Grid.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

{#snippet repoRow()}
  <Stack direction="row" align="center" gap="xs" responsive role="group" label="storefront">
    <Text truncate weight="semibold">storefront</Text>
    <Text tone="dim" size="small" truncate hideAt="narrow">feature/checkout</Text>
    <Stack direction="row" align="center" gap="xxs" hideAt="tiny">
      <Icon name="arrow-up" size="small" /><Text size="small" tabular>2</Text>
    </Stack>
    <Badge count={5} tone="quiet" label="5 changed files" hideAt="tiny" />
  </Stack>
{/snippet}

<Stack gap="xs">
  <Text weight="semibold">A column with a small gap</Text>
  <Text tone="dim">Every gap is a spacing token, never a pixel value.</Text>
</Stack>
<Stack direction="row" justify="between" align="center">
  <Text>Row, space between</Text>
  <Stack direction="row" gap="sm">
    <Button>Cancel</Button>
    <Button variant="primary">Save</Button>
  </Stack>
</Stack>
<Stack direction="row" wrap gap="xs">
  {#each ["main", "develop", "feature/login", "fix/crash", "release/1.0"] as branch (branch)}
    <Button size="small" icon="branch">{branch}</Button>
  {/each}
</Stack>
<Stack direction="row" gap="mdPlus" align="center">
  <Text>gap mdPlus (10)</Text>
  <Stack direction="row" gap="lgPlus" paddingX="lgPlus"><Text tone="dim">gap and padding lgPlus (14)</Text></Stack>
</Stack>
<Stack direction="row" gap="md">
  <Stack width="xsmall"><Text mono tone="dim">a1b2c3d</Text></Stack>
  <Stack width="large"><Text truncate>width large: 120 px, so rows line up</Text></Stack>
</Stack>
<Text tone="dim" size="small">scroll="x": the row scrolls in its own box instead of widening the page.</Text>
<Stack direction="row" gap="xs" scroll="x" paddingY="xs">
  {#each Array.from({ length: 14 }, (_, index) => `feature/branch-${index + 1}`) as branch (branch)}
    <Button size="small" icon="branch">{branch}</Button>
  {/each}
</Stack>
<Text tone="dim" size="small">sticky: scroll the page; the bar stays on top while its list is in view.</Text>
<Stack gap="none">
  <Stack sticky paddingY="sm"><Text weight="semibold">Keyboard shortcuts</Text></Stack>
  {#each Array.from({ length: 16 }, (_, index) => `Command ${index + 1}`) as command (command)}
    <Stack paddingY="xs"><Text>{command}</Text></Stack>
  {/each}
</Stack>
<Text tone="dim" size="small">
  responsive: under 320 px the branch name goes, under 220 the sync count and the change count go.
</Text>
{@render repoRow()}
<Grid columns="two">{@render repoRow()}{@render repoRow()}</Grid>
<Grid columns="four">{@render repoRow()}{@render repoRow()}{@render repoRow()}{@render repoRow()}</Grid>
<Stack busy role="region" label="Scripts">
  <Text tone="dim">busy and role: a region screen readers hear as loading.</Text>
</Stack>
<Stack element="nav" label="Sections" direction="row" gap="sm">
  <Text tone="dim">element="nav", "main" and "aside" mark a page's regions for screen readers.</Text>
</Stack>
