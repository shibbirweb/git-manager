<!-- One row of the Text tab: a file heading its matches, or a matching line. -->
<script lang="ts">
  import HighlightText from "@nibtree/ui/components/HighlightText.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { partsToRanges } from "@nibtree/ui/logic/highlight";
  import type { TextRow } from "./textSearchModel";

  let { row }: { row: TextRow } = $props();

  const line = $derived(row.kind === "textFile" ? null : partsToRanges(row.parts));
</script>

{#if row.kind === "textFile"}
  <Icon name="file" size="medium" />
  <Text weight="semibold" truncate>{row.name}</Text>
  <Stack grow><Text size="small" tone="faint" truncate>{row.folder}</Text></Stack>
  <Text size="xsmall" tone="faint">{row.count}</Text>
{:else if line}
  <Stack width="xxsmall" align="end"><Text mono size="compact" tone="faint">{row.line}</Text></Stack>
  <Stack grow>
    <Text mono truncate><HighlightText text={line.text} ranges={line.ranges} variant="mark" /></Text>
  </Stack>
{/if}
